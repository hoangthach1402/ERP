import { dbGet, dbAll, dbRun } from './database.js';
import { ProductActiveStage } from './ProductActiveStage.js';

export class ProductStageWorker {
  /**
   * Gán worker vào stage của product
   */
  static async assignWorker(productId, stageId, userId) {
    // Kiểm tra xem stage có đang active không
    const activeStage = await ProductActiveStage.findByProductAndStage(productId, stageId);
    if (!activeStage) {
      throw new Error('Stage is not active for this product');
    }

    if (activeStage.status === 'completed') {
      throw new Error('Cannot assign worker to a completed stage');
    }

    // Kiểm tra xem worker đã được gán chưa
    const existing = await dbGet(
      'SELECT * FROM product_stage_workers WHERE product_id = ? AND stage_id = ? AND user_id = ?',
      [productId, stageId, userId]
    );

    if (existing) {
      throw new Error('Worker already assigned to this stage');
    }

    // Tạo assignment mới
    const result = await dbRun(
      'INSERT INTO product_stage_workers (product_id, stage_id, user_id, status) VALUES (?, ?, ?, ?)',
      [productId, stageId, userId, 'assigned']
    );

    return this.findById(result.lastID);
  }

  /**
   * Gán nhiều workers cùng lúc
   */
  static async assignMultipleWorkers(productId, stageId, userIds) {
    const results = [];
    for (const userId of userIds) {
      try {
        const worker = await this.assignWorker(productId, stageId, userId);
        results.push(worker);
      } catch (error) {
        console.error(`Failed to assign user ${userId}:`, error.message);
      }
    }
    return results;
  }

  /**
   * Lấy thông tin worker theo ID
   */
  static async findById(id) {
    return dbGet(`
      SELECT psw.*, 
             u.full_name, u.username, u.role,
             p.product_code, p.product_name,
             s.stage_name, s.norm_hours
      FROM product_stage_workers psw
      LEFT JOIN users u ON psw.user_id = u.id
      LEFT JOIN products p ON psw.product_id = p.id
      LEFT JOIN stages s ON psw.stage_id = s.id
      WHERE psw.id = ?
    `, [id]);
  }

  /**
   * Lấy tất cả workers của một product-stage
   */
  static async getWorkersByProductStage(productId, stageId) {
    return dbAll(`
      SELECT psw.*, 
             u.full_name, u.username, u.role,
             CAST((julianday(COALESCE(psw.end_time, 'now')) - julianday(psw.start_time)) * 24 AS REAL) as hours_elapsed
      FROM product_stage_workers psw
      LEFT JOIN users u ON psw.user_id = u.id
      WHERE psw.product_id = ? AND psw.stage_id = ?
      ORDER BY psw.created_at ASC
    `, [productId, stageId]);
  }

  /**
   * Check if user is assigned to a product-stage
   */
  static async getWorkerByProductAndStage(productId, stageId, userId) {
    return dbAll(
      `SELECT * FROM product_stage_workers 
       WHERE product_id = ? AND stage_id = ? AND user_id = ?`,
      [productId, stageId, userId]
    );
  }

  /**
   * Lấy công việc của một user
   */
  static async getWorkerTasks(userId, status = null) {
    let query = `
      SELECT psw.*, 
             p.product_code, p.product_name,
             s.stage_name, s.norm_hours, s.sequence_order,
             pas.status as stage_status,
             CAST((julianday(COALESCE(psw.end_time, 'now')) - julianday(psw.start_time)) * 24 AS REAL) as hours_elapsed,
             COALESCE((SELECT SUM(CAST((julianday(COALESCE(end_time, 'now')) - julianday(start_time)) * 24 AS REAL))
              FROM product_stage_workers
              WHERE product_id = psw.product_id AND stage_id = psw.stage_id AND status IN ('working', 'completed')
             ), 0) as stage_total_hours
      FROM product_stage_workers psw
      LEFT JOIN products p ON psw.product_id = p.id
      LEFT JOIN stages s ON psw.stage_id = s.id
      LEFT JOIN product_active_stages pas ON psw.product_id = pas.product_id AND psw.stage_id = pas.stage_id
      WHERE psw.user_id = ?
    `;
    const params = [userId];

    if (status) {
      query += ' AND psw.status = ?';
      params.push(status);
    }

    query += ` ORDER BY 
      CASE psw.status 
        WHEN 'working' THEN 1
        WHEN 'assigned' THEN 2
        WHEN 'completed' THEN 3
      END,
      psw.created_at DESC`;

    return dbAll(query, params);
  }

  /**
   * Bắt đầu làm việc
   */
  static async startWork(productId, stageId, userId) {
    await dbRun(
      `UPDATE product_stage_workers 
       SET status = 'working', start_time = CURRENT_TIMESTAMP 
       WHERE product_id = ? AND stage_id = ? AND user_id = ?`,
      [productId, stageId, userId]
    );

    return this.findByProductStageUser(productId, stageId, userId);
  }

  /**
   * Hoàn thành công việc
   */
  static async completeWork(productId, stageId, userId, notes = null) {
    const worker = await this.findByProductStageUser(productId, stageId, userId);
    
    if (!worker) {
      throw new Error('Worker assignment not found');
    }

    if (worker.status === 'completed') {
      throw new Error('Work already completed');
    }

    // Tính số giờ làm việc
    const hoursWorked = worker.start_time ? 
      (new Date() - new Date(worker.start_time)) / (1000 * 60 * 60) : 0;

    await dbRun(
      `UPDATE product_stage_workers 
       SET status = 'completed', 
           end_time = CURRENT_TIMESTAMP,
           hours_worked = ?,
           notes = ?
       WHERE product_id = ? AND stage_id = ? AND user_id = ?`,
      [hoursWorked, notes, productId, stageId, userId]
    );

    // Kiểm tra xem tất cả workers đã hoàn thành chưa
    const canComplete = await ProductActiveStage.canComplete(productId, stageId);
    if (canComplete) {
      await ProductActiveStage.completeStage(productId, stageId);
    }

    return this.findByProductStageUser(productId, stageId, userId);
  }

  /**
   * Tạm dừng công việc
   */
  static async pauseWork(productId, stageId, userId, reason = null) {
    await dbRun(
      `UPDATE product_stage_workers 
       SET status = 'assigned', notes = ?
       WHERE product_id = ? AND stage_id = ? AND user_id = ?`,
      [reason, productId, stageId, userId]
    );

    return this.findByProductStageUser(productId, stageId, userId);
  }

  /**
   * Xóa worker khỏi stage (chỉ khi chưa bắt đầu hoặc chưa hoàn thành)
   */
  static async removeWorker(productId, stageId, userId) {
    const worker = await this.findByProductStageUser(productId, stageId, userId);
    
    if (!worker) {
      throw new Error('Worker assignment not found');
    }

    if (worker.status === 'completed') {
      throw new Error('Cannot remove worker who has completed the work');
    }

    await dbRun(
      'DELETE FROM product_stage_workers WHERE product_id = ? AND stage_id = ? AND user_id = ?',
      [productId, stageId, userId]
    );

    return { success: true, message: 'Worker removed successfully' };
  }

  /**
   * Lấy worker theo product, stage và user
   */
  static async findByProductStageUser(productId, stageId, userId) {
    return dbGet(`
      SELECT psw.*, 
             u.full_name, u.username, u.role,
             p.product_code, p.product_name,
             s.stage_name, s.norm_hours,
             CAST((julianday(COALESCE(psw.end_time, 'now')) - julianday(psw.start_time)) * 24 AS REAL) as hours_elapsed
      FROM product_stage_workers psw
      LEFT JOIN users u ON psw.user_id = u.id
      LEFT JOIN products p ON psw.product_id = p.id
      LEFT JOIN stages s ON psw.stage_id = s.id
      WHERE psw.product_id = ? AND psw.stage_id = ? AND psw.user_id = ?
    `, [productId, stageId, userId]);
  }

  /**
   * Lấy thống kê workers theo stage
   */
  static async getStageWorkersStats(stageId) {
    return dbAll(`
      SELECT 
        p.product_code,
        p.product_name,
        COUNT(psw.id) as total_workers,
        COUNT(CASE WHEN psw.status = 'working' THEN 1 END) as working_count,
        COUNT(CASE WHEN psw.status = 'assigned' THEN 1 END) as assigned_count,
        COUNT(CASE WHEN psw.status = 'completed' THEN 1 END) as completed_count,
        AVG(psw.hours_worked) as avg_hours_worked,
        SUM(psw.hours_worked) as total_hours_worked
      FROM products p
      JOIN product_active_stages pas ON p.id = pas.product_id
      LEFT JOIN product_stage_workers psw ON p.id = psw.product_id AND pas.stage_id = psw.stage_id
      WHERE pas.stage_id = ? AND pas.status = 'active'
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [stageId]);
  }

  /**
   * Lấy tất cả workers của một product (tất cả stages)
   */
  static async getAllWorkersByProduct(productId) {
    return dbAll(`
      SELECT psw.*, 
             u.full_name, u.username, u.role,
             s.stage_name, s.sequence_order,
             CAST((julianday(COALESCE(psw.end_time, 'now')) - julianday(psw.start_time)) * 24 AS REAL) as hours_elapsed
      FROM product_stage_workers psw
      LEFT JOIN users u ON psw.user_id = u.id
      LEFT JOIN stages s ON psw.stage_id = s.id
      WHERE psw.product_id = ?
      ORDER BY s.sequence_order ASC, psw.created_at ASC
    `, [productId]);
  }
}

export default ProductStageWorker;
