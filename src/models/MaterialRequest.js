import { dbGet, dbAll, dbRun } from './database.js';

export class MaterialRequest {
  /**
   * Tạo yêu cầu mua nguyên vật liệu mới
   */
  static async create(requestData) {
    const { product_id, stage_id, requested_by_user_id, reason } = requestData;
    
    const result = await dbRun(
      `INSERT INTO material_requests (product_id, stage_id, requested_by_user_id, reason, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [product_id, stage_id, requested_by_user_id, reason, 'pending']
    );

    return this.findById(result.lastID);
  }

  /**
   * Lấy yêu cầu theo ID
   */
  static async findById(id) {
    return dbGet(`
      SELECT mr.*, 
             p.product_code, p.product_name,
             s.stage_name,
             u1.full_name as requested_by_name,
             u1.role as requested_by_role,
             u2.full_name as purchased_by_name,
             u2.role as purchased_by_role
      FROM material_requests mr
      LEFT JOIN products p ON mr.product_id = p.id
      LEFT JOIN stages s ON mr.stage_id = s.id
      LEFT JOIN users u1 ON mr.requested_by_user_id = u1.id
      LEFT JOIN users u2 ON mr.purchased_by_user_id = u2.id
      WHERE mr.id = ?
    `, [id]);
  }

  /**
   * Lấy tất cả yêu cầu với filter
   */
  static async getAll(filters = {}) {
    let query = `
      SELECT mr.*, 
             p.product_code, p.product_name,
             s.stage_name,
             u1.full_name as requested_by_name,
             u1.role as requested_by_role,
             u2.full_name as purchased_by_name,
             u2.role as purchased_by_role
      FROM material_requests mr
      LEFT JOIN products p ON mr.product_id = p.id
      LEFT JOIN stages s ON mr.stage_id = s.id
      LEFT JOIN users u1 ON mr.requested_by_user_id = u1.id
      LEFT JOIN users u2 ON mr.purchased_by_user_id = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ' AND mr.status = ?';
      params.push(filters.status);
    }

    if (filters.stage_id) {
      query += ' AND mr.stage_id = ?';
      params.push(filters.stage_id);
    }

    query += ' ORDER BY mr.created_at DESC';
    return dbAll(query, params);
  }

  /**
   * Lấy yêu cầu đang chờ (pending)
   */
  static async getPending() {
    return this.getAll({ status: 'pending' });
  }

  /**
   * Thu mua xác nhận đã mua
   */
  static async markAsPurchased(id, purchasedData) {
    const { purchased_by_user_id, expected_delivery_date, response_note } = purchasedData;

    await dbRun(
      `UPDATE material_requests 
       SET status = ?, purchased_by_user_id = ?, purchased_at = CURRENT_TIMESTAMP, 
           expected_delivery_date = ?, response_note = ?
       WHERE id = ?`,
      ['purchased', purchased_by_user_id, expected_delivery_date, response_note || null, id]
    );

    return this.findById(id);
  }

  /**
   * Đánh dấu đã giao hàng
   */
  static async markAsDelivered(id) {
    await dbRun(
      `UPDATE material_requests 
       SET status = ?, delivered_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      ['delivered', id]
    );

    return this.findById(id);
  }

  /**
   * Lấy thống kê yêu cầu
   */
  static async getStats() {
    const stats = await dbGet(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'purchased' THEN 1 ELSE 0 END) as purchased,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered
      FROM material_requests
    `);

    return stats;
  }

  /**
   * Lấy messages của một request
   */
  static async getMessages(requestId) {
    try {
      return dbAll(`
        SELECT m.*, u.full_name, u.role
        FROM material_request_messages m
        LEFT JOIN users u ON m.user_id = u.id
        WHERE m.request_id = ?
        ORDER BY m.created_at ASC
      `, [requestId]);
    } catch (error) {
      // Table might not exist yet, return empty array
      if (error.code === 'SQLITE_ERROR' && error.message.includes('no such table')) {
        console.warn('material_request_messages table not yet created');
        return [];
      }
      throw error;
    }
  }

  /**
   * Thêm message mới
   */
  static async addMessage(requestId, userId, message) {
    try {
      await dbRun(
        `INSERT INTO material_request_messages (request_id, user_id, message) 
         VALUES (?, ?, ?)`,
        [requestId, userId, message]
      );
    } catch (error) {
      // Table might not exist yet
      if (error.code === 'SQLITE_ERROR' && error.message.includes('no such table')) {
        console.warn('material_request_messages table not yet created, skipping message insert');
        return [];
      }
      throw error;
    }

    return this.getMessages(requestId);
  }

  /**
   * Đếm số tin nhắn chưa đọc (sau lần update cuối của request)
   */
  static async getUnreadCount(requestId) {
    const request = await this.findById(requestId);
    if (!request) return 0;

    const count = await dbGet(`
      SELECT COUNT(*) as count
      FROM material_request_messages
      WHERE request_id = ? AND created_at > ?
    `, [requestId, request.purchased_at || request.created_at]);

    return count?.count || 0;
  }
}

export default MaterialRequest;
