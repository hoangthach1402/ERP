import { dbGet, dbAll, dbRun } from './database.js';

export class ProductActiveStage {
  /**
   * Tạo hoặc kích hoạt một stage cho product
   */
  static async activateStage(productId, stageId) {
    // Kiểm tra xem stage đã được tạo chưa
    const existing = await dbGet(
      'SELECT * FROM product_active_stages WHERE product_id = ? AND stage_id = ?',
      [productId, stageId]
    );

    if (existing) {
      // Nếu đã tồn tại, cập nhật trạng thái
      if (existing.status === 'completed') {
        throw new Error('Cannot reactivate a completed stage');
      }
      await dbRun(
        'UPDATE product_active_stages SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['active', existing.id]
      );
      return this.findById(existing.id);
    }

    // Tạo mới
    const result = await dbRun(
      'INSERT INTO product_active_stages (product_id, stage_id, status) VALUES (?, ?, ?)',
      [productId, stageId, 'active']
    );

    return this.findById(result.lastID);
  }

  /**
   * Lấy thông tin stage theo ID
   */
  static async findById(id) {
    return dbGet(`
      SELECT pas.*, 
             p.product_code, p.product_name,
             s.stage_name, s.norm_hours
      FROM product_active_stages pas
      LEFT JOIN products p ON pas.product_id = p.id
      LEFT JOIN stages s ON pas.stage_id = s.id
      WHERE pas.id = ?
    `, [id]);
  }

  /**
   * Lấy tất cả stages đang active của một product
   */
  static async getActiveStagesByProduct(productId) {
    return dbAll(`
      SELECT pas.*, 
             s.stage_name, s.norm_hours,
             COUNT(psw.id) as worker_count,
             COUNT(CASE WHEN psw.status = 'working' THEN 1 END) as working_count,
             COUNT(CASE WHEN psw.status = 'completed' THEN 1 END) as completed_count
      FROM product_active_stages pas
      LEFT JOIN stages s ON pas.stage_id = s.id
      LEFT JOIN product_stage_workers psw ON pas.product_id = psw.product_id AND pas.stage_id = psw.stage_id
      WHERE pas.product_id = ? AND pas.status = 'active'
      GROUP BY pas.id
      ORDER BY s.sequence_order ASC
    `, [productId]);
  }

  /**
   * Lấy tất cả products đang làm ở một stage
   */
  static async getProductsByStage(stageId, status = 'active') {
    return dbAll(`
      SELECT pas.*, 
             p.product_code, p.product_name, p.status as product_status,
             s.stage_name,
             COUNT(psw.id) as worker_count,
             COUNT(CASE WHEN psw.status = 'working' THEN 1 END) as working_count
      FROM product_active_stages pas
      LEFT JOIN products p ON pas.product_id = p.id
      LEFT JOIN stages s ON pas.stage_id = s.id
      LEFT JOIN product_stage_workers psw ON pas.product_id = psw.product_id AND pas.stage_id = psw.stage_id
      WHERE pas.stage_id = ? AND pas.status = ?
      GROUP BY pas.id
      ORDER BY pas.started_at ASC
    `, [stageId, status]);
  }

  /**
   * Đánh dấu stage hoàn thành
   */
  static async completeStage(productId, stageId) {
    await dbRun(
      `UPDATE product_active_stages 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
       WHERE product_id = ? AND stage_id = ?`,
      [productId, stageId]
    );

    return this.findByProductAndStage(productId, stageId);
  }

  /**
   * Tạm dừng stage
   */
  static async pauseStage(productId, stageId) {
    await dbRun(
      'UPDATE product_active_stages SET status = ? WHERE product_id = ? AND stage_id = ?',
      ['paused', productId, stageId]
    );

    return this.findByProductAndStage(productId, stageId);
  }

  /**
   * Lấy stage theo product và stage ID
   */
  static async findByProductAndStage(productId, stageId) {
    return dbGet(`
      SELECT pas.*, 
             s.stage_name, s.norm_hours,
             COUNT(psw.id) as worker_count,
             COUNT(CASE WHEN psw.status = 'working' THEN 1 END) as working_count,
             COUNT(CASE WHEN psw.status = 'completed' THEN 1 END) as completed_count
      FROM product_active_stages pas
      LEFT JOIN stages s ON pas.stage_id = s.id
      LEFT JOIN product_stage_workers psw ON pas.product_id = psw.product_id AND pas.stage_id = psw.stage_id
      WHERE pas.product_id = ? AND pas.stage_id = ?
      GROUP BY pas.id
    `, [productId, stageId]);
  }

  /**
   * Lấy tổng quan tất cả active stages
   */
  static async getOverview() {
    return dbAll(`
      SELECT 
        p.id as product_id,
        p.product_code,
        p.product_name,
        GROUP_CONCAT(DISTINCT s.stage_name) as active_stages,
        COUNT(DISTINCT pas.stage_id) as stage_count,
        COUNT(DISTINCT psw.user_id) as total_workers,
        COUNT(DISTINCT CASE WHEN psw.status = 'working' THEN psw.user_id END) as working_now
      FROM products p
      JOIN product_active_stages pas ON p.id = pas.product_id
      JOIN stages s ON pas.stage_id = s.id
      LEFT JOIN product_stage_workers psw ON p.id = psw.product_id AND pas.stage_id = psw.stage_id
      WHERE pas.status = 'active'
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
  }

  /**
   * Kiểm tra xem stage có thể được hoàn thành không (tất cả workers đã xong)
   */
  static async canComplete(productId, stageId) {
    const result = await dbGet(`
      SELECT COUNT(*) as pending_count
      FROM product_stage_workers
      WHERE product_id = ? AND stage_id = ? AND status != 'completed'
    `, [productId, stageId]);

    return result.pending_count === 0;
  }
}

export default ProductActiveStage;
