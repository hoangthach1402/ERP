import { dbGet, dbAll, dbRun } from './database.js';

export class Stage {
  static async findById(id) {
    return dbGet('SELECT * FROM stages WHERE id = ?', [id]);
  }

  static async findByName(name) {
    return dbGet('SELECT * FROM stages WHERE stage_name = ?', [name]);
  }

  static async getAll() {
    return dbAll('SELECT * FROM stages ORDER BY sequence_order ASC');
  }

  static async getBySequenceOrder(order) {
    return dbGet('SELECT * FROM stages WHERE sequence_order = ?', [order]);
  }

  static async getNextStage(currentStageId) {
    const currentStage = await this.findById(currentStageId);
    if (!currentStage) return null;

    return dbGet(
      'SELECT * FROM stages WHERE sequence_order = ? LIMIT 1',
      [currentStage.sequence_order + 1]
    );
  }

  static async getMaxSequenceOrder() {
    const row = await dbGet('SELECT MAX(sequence_order) as maxOrder FROM stages');
    return row?.maxOrder || 0;
  }

  static async create({ stage_name, norm_hours, description }) {
    const maxOrder = await this.getMaxSequenceOrder();
    const result = await dbRun(
      'INSERT INTO stages (stage_name, norm_hours, sequence_order, description) VALUES (?, ?, ?, ?)',
      [stage_name, norm_hours, maxOrder + 1, description || null]
    );

    return this.findById(result.lastID);
  }

  static async updateStage(id, { stage_name, norm_hours, description }) {
    await dbRun(
      'UPDATE stages SET stage_name = ?, norm_hours = ?, description = ? WHERE id = ?',
      [stage_name, norm_hours, description || null, id]
    );

    return this.findById(id);
  }

  static async reorder(stageIds) {
    await dbRun('BEGIN TRANSACTION');
    try {
      for (let i = 0; i < stageIds.length; i++) {
        await dbRun(
          'UPDATE stages SET sequence_order = ? WHERE id = ?',
          [i + 1, stageIds[i]]
        );
      }
      await dbRun('COMMIT');
    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }
  }

  static async deleteWithCascade(id) {
    await dbRun('BEGIN TRANSACTION');
    try {
      const fallback = await dbGet(
        'SELECT id FROM stages WHERE id != ? ORDER BY sequence_order ASC LIMIT 1',
        [id]
      );

      if (!fallback) {
        throw new Error('At least one stage must remain');
      }

      await dbRun(
        'UPDATE products SET current_stage_id = ? WHERE current_stage_id = ?',
        [fallback.id, id]
      );

      await dbRun(
        'DELETE FROM material_request_messages WHERE request_id IN (SELECT id FROM material_requests WHERE stage_id = ?)',
        [id]
      );
      await dbRun('DELETE FROM material_requests WHERE stage_id = ?', [id]);
      await dbRun('DELETE FROM product_stage_workers WHERE stage_id = ?', [id]);
      await dbRun('DELETE FROM product_active_stages WHERE stage_id = ?', [id]);
      await dbRun('DELETE FROM product_stage_tasks WHERE stage_id = ?', [id]);
      await dbRun('DELETE FROM activity_logs WHERE stage_id = ?', [id]);
      await dbRun('DELETE FROM stages WHERE id = ?', [id]);

      const remaining = await dbAll('SELECT id FROM stages ORDER BY sequence_order ASC');
      for (let i = 0; i < remaining.length; i++) {
        await dbRun('UPDATE stages SET sequence_order = ? WHERE id = ?', [i + 1, remaining[i].id]);
      }

      await dbRun('COMMIT');
    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }
  }
}

export class ProductStageTask {
  static async create(taskData) {
    const { product_id, stage_id, assigned_user_id } = taskData;
    
    const result = await dbRun(
      'INSERT INTO product_stage_tasks (product_id, stage_id, assigned_user_id, status) VALUES (?, ?, ?, ?)',
      [product_id, stage_id, assigned_user_id || null, 'pending']
    );

    return this.findById(result.lastID);
  }

  static async findById(id) {
    return dbGet(`
      SELECT pst.*, s.stage_name, s.norm_hours, u.full_name as assigned_user
      FROM product_stage_tasks pst
      LEFT JOIN stages s ON pst.stage_id = s.id
      LEFT JOIN users u ON pst.assigned_user_id = u.id
      WHERE pst.id = ?
    `, [id]);
  }

  static async findByProductAndStage(productId, stageId) {
    return dbGet(`
      SELECT pst.*, s.stage_name, s.norm_hours
      FROM product_stage_tasks pst
      LEFT JOIN stages s ON pst.stage_id = s.id
      WHERE pst.product_id = ? AND pst.stage_id = ?
    `, [productId, stageId]);
  }

  static async startTask(taskId, userId) {
    await dbRun(
      'UPDATE product_stage_tasks SET start_time = CURRENT_TIMESTAMP, status = ?, assigned_user_id = ?, pending_reason = NULL WHERE id = ?',
      ['processing', userId, taskId]
    );

    return this.findById(taskId);
  }

  static async completeTask(taskId) {
    await dbRun(
      'UPDATE product_stage_tasks SET end_time = CURRENT_TIMESTAMP, status = ? WHERE id = ?',
      ['completed', taskId]
    );

    return this.findById(taskId);
  }

  static async setPending(taskId, userId, reason) {
    await dbRun(
      'UPDATE product_stage_tasks SET status = ?, pending_reason = ?, assigned_user_id = ?, start_time = NULL, end_time = NULL, is_delayed = 0 WHERE id = ?',
      ['pending', reason, userId, taskId]
    );

    return this.findById(taskId);
  }

  static async checkAndMarkDelayed(taskId) {
    const task = await this.findById(taskId);
    if (!task || task.status === 'completed') return task;

    if (task.start_time) {
      const elapsedMillis = new Date() - new Date(task.start_time);
      const elapsedHours = elapsedMillis / (1000 * 60 * 60);

      if (elapsedHours > task.norm_hours) {
        await dbRun('UPDATE product_stage_tasks SET is_delayed = 1 WHERE id = ?', [taskId]);
        return this.findById(taskId);
      }
    }

    return task;
  }

  static async getDelayedTasks() {
    return dbAll(`
      SELECT pst.*, s.stage_name, s.norm_hours, p.product_code, p.product_name, u.full_name
      FROM product_stage_tasks pst
      LEFT JOIN stages s ON pst.stage_id = s.id
      LEFT JOIN products p ON pst.product_id = p.id
      LEFT JOIN users u ON pst.assigned_user_id = u.id
      WHERE pst.is_delayed = 1 AND pst.status != 'completed'
      ORDER BY pst.start_time ASC
    `);
  }

  static async getTasksByProduct(productId) {
    return dbAll(`
      SELECT pst.*, s.stage_name, s.norm_hours, u.full_name
      FROM product_stage_tasks pst
      LEFT JOIN stages s ON pst.stage_id = s.id
      LEFT JOIN users u ON pst.assigned_user_id = u.id
      WHERE pst.product_id = ?
      ORDER BY s.sequence_order ASC
    `, [productId]);
  }

  static async getTasksByStage(stageId) {
    return dbAll(`
      SELECT pst.*, s.stage_name, s.norm_hours, p.product_code, p.product_name, u.full_name
      FROM product_stage_tasks pst
      LEFT JOIN stages s ON pst.stage_id = s.id
      LEFT JOIN products p ON pst.product_id = p.id
      LEFT JOIN users u ON pst.assigned_user_id = u.id
      WHERE pst.stage_id = ?
      ORDER BY pst.status, pst.start_time DESC
    `, [stageId]);
  }
}

export default { Stage, ProductStageTask };
