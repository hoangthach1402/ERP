import { dbRun, dbGet, dbAll } from './database.js';

export class ActivityLog {
  static async log(userId, action, details = {}, productId = null, stageId = null) {
    await dbRun(
      'INSERT INTO activity_logs (user_id, product_id, stage_id, action, details) VALUES (?, ?, ?, ?, ?)',
      [userId, productId, stageId, action, JSON.stringify(details)]
    );
  }

  static async getByProduct(productId) {
    return dbAll(
      `SELECT al.*, u.full_name, s.stage_name
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       LEFT JOIN stages s ON al.stage_id = s.id
       WHERE al.product_id = ?
       ORDER BY al.created_at DESC`,
      [productId]
    );
  }

  static async getRecent(limit = 50) {
    return dbAll(
      `SELECT al.*, u.full_name, p.product_code, s.stage_name
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       LEFT JOIN products p ON al.product_id = p.id
       LEFT JOIN stages s ON al.stage_id = s.id
       ORDER BY al.created_at DESC
       LIMIT ?`,
      [limit]
    );
  }
}

export default ActivityLog;
