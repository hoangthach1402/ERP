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
      'UPDATE product_stage_tasks SET start_time = CURRENT_TIMESTAMP, status = ?, assigned_user_id = ? WHERE id = ?',
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
