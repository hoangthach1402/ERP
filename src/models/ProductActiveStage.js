import { dbGet, dbAll, dbRun } from './database.js';

export class ProductActiveStage {
  /**
   * Tạo hoặc kích hoạt một stage cho product
   */
  static async activateStage(productId, stageId, options = {}) {
    // Kiểm tra xem stage đã được tạo chưa
    const existing = await dbGet(
      'SELECT * FROM product_active_stages WHERE product_id = ? AND stage_id = ?',
      [productId, stageId]
    );

    if (existing) {
      // Nếu đã tồn tại, cập nhật trạng thái
      if (existing.status === 'completed' && !options.allowRework) {
        throw new Error('Cannot reactivate a completed stage');
      }

      const normHours = options.norm_hours ?? existing.norm_hours ?? null;
      await dbRun(
        'UPDATE product_active_stages SET status = ?, started_at = CURRENT_TIMESTAMP, completed_at = NULL, norm_hours = ? WHERE id = ?',
        ['active', normHours, existing.id]
      );
      return this.findById(existing.id);
    }

    // Tạo mới
    const normHours = options.norm_hours ?? null;
    const result = await dbRun(
      'INSERT INTO product_active_stages (product_id, stage_id, status, norm_hours) VALUES (?, ?, ?, ?)',
      [productId, stageId, 'active', normHours]
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
             s.stage_name, COALESCE(pas.norm_hours, s.norm_hours) as norm_hours
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
             s.stage_name, COALESCE(pas.norm_hours, s.norm_hours) as norm_hours,
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
             s.stage_name, COALESCE(pas.norm_hours, s.norm_hours) as norm_hours,
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

    // Kiểm tra và tự động đưa vào kho nếu tất cả stages đã hoàn thành
    const { Warehouse } = await import('./Warehouse.js');
    await Warehouse.autoMoveToWarehouseIfComplete(productId);

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
        GROUP_CONCAT(s.stage_name || '||' || s.id || '||' || 
          IFNULL((SELECT COUNT(*) FROM product_stage_workers psw2 
                  WHERE psw2.product_id = p.id AND psw2.stage_id = s.id), 0), '##') as stage_details,
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
   * Lấy tổng hợp sản phẩm đã hoàn thành stage
   */
  static async getCompletedProductsSummary() {
    return dbAll(`
      SELECT
        p.id as product_id,
        p.product_code,
        p.product_name,
        GROUP_CONCAT(s.stage_name || '||' || IFNULL(s.description, '') || '||' || COALESCE(pas.norm_hours, s.norm_hours), '##') as stage_details,
        SUM(COALESCE(pas.norm_hours, s.norm_hours)) as total_norm_hours,
        MAX(pas.completed_at) as last_completed_at
      FROM product_active_stages pas
      JOIN products p ON pas.product_id = p.id
      JOIN stages s ON pas.stage_id = s.id
      WHERE pas.status = 'completed'
      GROUP BY p.id
      ORDER BY last_completed_at DESC, p.id DESC
    `);
  }

  /**
   * Lấy danh sách stage đã hoàn thành theo product
   */
  static async getCompletedStagesByProduct(productId) {
    return dbAll(`
      SELECT
        pas.stage_id,
        pas.completed_at,
        s.stage_name,
        s.description,
        COALESCE(pas.norm_hours, s.norm_hours) as norm_hours
      FROM product_active_stages pas
      JOIN stages s ON pas.stage_id = s.id
      WHERE pas.product_id = ? AND pas.status = 'completed'
      ORDER BY s.sequence_order ASC
    `, [productId]);
  }

  /**
   * Lấy danh sách workers theo stage đã hoàn thành của product
   */
  static async getCompletedStageWorkersByProduct(productId) {
    return dbAll(`
      SELECT
        psw.stage_id,
        psw.start_time,
        psw.end_time,
        psw.hours_worked,
        psw.status,
        u.full_name,
        u.username,
        u.role
      FROM product_stage_workers psw
      JOIN product_active_stages pas ON psw.product_id = pas.product_id AND psw.stage_id = pas.stage_id
      JOIN users u ON psw.user_id = u.id
      WHERE psw.product_id = ? AND pas.status = 'completed'
      ORDER BY psw.stage_id ASC, psw.start_time ASC
    `, [productId]);
  }

  /**
   * Lấy danh sách stages đã hoàn thành
   */
  static async getCompletedStages() {
    return dbAll(`
      SELECT pas.*, 
             p.product_code, p.product_name,
             s.stage_name, s.norm_hours,
             COUNT(psw.id) as worker_count
      FROM product_active_stages pas
      JOIN products p ON pas.product_id = p.id
      JOIN stages s ON pas.stage_id = s.id
      LEFT JOIN product_stage_workers psw ON pas.product_id = psw.product_id AND pas.stage_id = psw.stage_id
      WHERE pas.status = 'completed'
      GROUP BY pas.id
      ORDER BY pas.completed_at DESC, pas.id DESC
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
