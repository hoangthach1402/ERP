import { dbGet, dbAll, dbRun } from './database.js';

export class Product {
  static async create(productData) {
    const { product_code, product_name, stageHours } = productData;
    // First stage is always "RẬP" (id = 1), or the first available stage
    const result = await dbRun(
      'INSERT INTO products (product_code, product_name, current_stage_id, status) VALUES (?, ?, ?, ?)',
      [product_code, product_name, 1, 'pending']
    );
    
    // Create initial product_stage_tasks for selected stages only
    if (stageHours && typeof stageHours === 'object') {
      for (const [stageId, normHours] of Object.entries(stageHours)) {
        const stageIdInt = parseInt(stageId);
        const normHoursInt = parseInt(normHours) || 0;
        
        if (stageIdInt > 0 && normHoursInt > 0) {
          await dbRun(
            'INSERT INTO product_stage_tasks (product_id, stage_id, status, norm_hours) VALUES (?, ?, ?, ?)',
            [result.lastID, stageIdInt, 'pending', normHoursInt]
          );
        }
      }
    }
    
    return this.findById(result.lastID);
  }

  static async findById(id) {
    return dbGet(`
      SELECT p.id, p.product_code, p.product_name, p.status, p.current_stage_id, p.created_at, p.completed_at,
             s.stage_name, s.norm_hours
      FROM products p
      LEFT JOIN stages s ON p.current_stage_id = s.id
      WHERE p.id = ?
    `, [id]);
  }

  static async findByCode(code) {
    return dbGet(`
      SELECT p.id, p.product_code, p.product_name, p.status, p.current_stage_id, p.created_at, p.completed_at,
             s.stage_name, s.norm_hours
      FROM products p
      LEFT JOIN stages s ON p.current_stage_id = s.id
      WHERE p.product_code = ?
    `, [code]);
  }

  static async getAll(filters = {}) {
    let query = `
      SELECT p.id, p.product_code, p.product_name, p.status, p.current_stage_id,
             s.stage_name, s.norm_hours,
             pst.start_time, pst.end_time, pst.is_delayed,
             u.full_name as assigned_user,
             CAST((julianday('now') - julianday(pst.start_time)) * 24 AS INTEGER) as elapsed_hours
      FROM products p
      LEFT JOIN stages s ON p.current_stage_id = s.id
      LEFT JOIN product_stage_tasks pst ON p.id = pst.product_id AND p.current_stage_id = pst.stage_id
      LEFT JOIN users u ON pst.assigned_user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ' AND p.status = ?';
      params.push(filters.status);
    }

    if (filters.stage_id) {
      query += ' AND p.current_stage_id = ?';
      params.push(filters.stage_id);
    }

    query += ' ORDER BY p.created_at DESC';
    return dbAll(query, params);
  }

  static async getProductsByStage(stageId) {
    return dbAll(`
      SELECT p.id, p.product_code, p.product_name, p.status, p.current_stage_id,
             s.stage_name, s.norm_hours,
             pst.id as task_id, pst.status as task_status, pst.start_time, pst.end_time, pst.is_delayed,
             u.full_name as assigned_user,
             CAST((julianday('now') - julianday(pst.start_time)) * 24 AS INTEGER) as elapsed_hours
      FROM products p
      LEFT JOIN stages s ON p.current_stage_id = s.id
      LEFT JOIN product_stage_tasks pst ON p.id = pst.product_id AND p.current_stage_id = pst.stage_id
      LEFT JOIN users u ON pst.assigned_user_id = u.id
      WHERE p.current_stage_id = ? AND p.status != 'completed'
      ORDER BY 
        CASE pst.status 
          WHEN 'processing' THEN 1
          WHEN 'pending' THEN 2
          ELSE 3
        END,
        p.created_at DESC
    `, [stageId]);
  }

  static async updateStatus(productId, status) {
    await dbRun('UPDATE products SET status = ? WHERE id = ?', [status, productId]);
    return this.findById(productId);
  }

  static async moveToNextStage(productId) {
    const product = await this.findById(productId);
    if (!product) throw new Error('Product not found');

    // Get current stage order
    const currentStage = await dbGet('SELECT sequence_order FROM stages WHERE id = ?', [product.current_stage_id]);
    
    // Get next stage
    const nextStage = await dbGet(
      'SELECT id, stage_name FROM stages WHERE sequence_order = ? LIMIT 1',
      [currentStage.sequence_order + 1]
    );

    if (!nextStage) {
      // No more stages, mark as completed
      await dbRun('UPDATE products SET status = ? WHERE id = ?', ['completed', productId]);
      await dbRun('UPDATE products SET completed_at = CURRENT_TIMESTAMP WHERE id = ?', [productId]);
      return this.findById(productId);
    }

    // Move to next stage (task already exists from product creation)
    await dbRun('UPDATE products SET current_stage_id = ?, status = ? WHERE id = ?', 
      [nextStage.id, 'pending', productId]);

    return this.findById(productId);
  }

  static async getProductsWithDetails() {
    return dbAll(`
      SELECT p.id, p.product_code, p.product_name, p.status,
             s.stage_name, s.norm_hours,
             pst.start_time, pst.end_time, pst.is_delayed,
             u.full_name as assigned_user,
             CAST((julianday('now') - julianday(pst.start_time)) * 24 AS INTEGER) as elapsed_hours
      FROM products p
      LEFT JOIN stages s ON p.current_stage_id = s.id
      LEFT JOIN product_stage_tasks pst ON p.id = pst.product_id AND p.current_stage_id = pst.stage_id
      LEFT JOIN users u ON pst.assigned_user_id = u.id
      ORDER BY p.created_at DESC
    `);
  }
}

export default Product;
