import { dbRun, dbGet, dbAll } from './database.js';

export class Warehouse {
  /**
   * Thêm sản phẩm vào kho (tự động khi hoàn thành tất cả stages)
   */
  static async addProduct(productId) {
    try {
      // Kiểm tra xem sản phẩm đã có trong kho chưa
      const existing = await dbGet(
        'SELECT id FROM warehouse_inventory WHERE product_id = ? AND item_type = "product" AND exported_at IS NULL',
        [productId]
      );

      if (existing) {
        console.log(`Product ${productId} already in warehouse`);
        return existing;
      }

      // Lấy thông tin sản phẩm
      const product = await dbGet(
        'SELECT product_code, product_name FROM products WHERE id = ?',
        [productId]
      );

      if (!product) {
        throw new Error('Product not found');
      }

      const result = await dbRun(
        `INSERT INTO warehouse_inventory (product_id, item_type, item_name, item_description)
         VALUES (?, 'product', ?, ?)`,
        [productId, product.product_code, product.product_name]
      );

      console.log(`✓ Product ${productId} added to warehouse`);
      return { id: result.lastID };
    } catch (error) {
      console.error('Error adding product to warehouse:', error);
      throw error;
    }
  }

  /**
   * Thêm hàng tự do vào kho (không phải product)
   */
  static async addCustomItem(itemType, itemName, itemDescription, quantity = 1) {
    try {
      if (!['document', 'personal', 'misc'].includes(itemType)) {
        throw new Error('Invalid item type. Must be: document, personal, or misc');
      }

      const result = await dbRun(
        `INSERT INTO warehouse_inventory (item_type, item_name, item_description, quantity)
         VALUES (?, ?, ?, ?)`,
        [itemType, itemName, itemDescription, quantity]
      );

      console.log(`✓ Custom item "${itemName}" added to warehouse`);
      return { id: result.lastID };
    } catch (error) {
      console.error('Error adding custom item to warehouse:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách hàng trong kho (chưa xuất)
   */
  static async getAvailableInventory() {
    try {
      const items = await dbAll(`
        SELECT 
          wi.id,
          wi.product_id,
          wi.item_type,
          wi.item_name,
          wi.item_description,
          wi.quantity,
          wi.added_at,
          p.product_code,
          p.product_name
        FROM warehouse_inventory wi
        LEFT JOIN products p ON wi.product_id = p.id
        WHERE wi.exported_at IS NULL
        ORDER BY wi.added_at DESC
      `);

      return items;
    } catch (error) {
      console.error('Error getting warehouse inventory:', error);
      throw error;
    }
  }

  /**
   * Lấy danh sách sản phẩm đã hoàn thành trong kho (chưa xuất)
   */
  static async getAvailableProducts() {
    try {
      const products = await dbAll(`
        SELECT 
          wi.id as warehouse_id,
          wi.product_id,
          wi.added_at,
          p.product_code,
          p.product_name,
          p.status
        FROM warehouse_inventory wi
        INNER JOIN products p ON wi.product_id = p.id
        WHERE wi.item_type = 'product' AND wi.exported_at IS NULL
        ORDER BY wi.added_at DESC
      `);

      return products;
    } catch (error) {
      console.error('Error getting warehouse products:', error);
      throw error;
    }
  }

  /**
   * Đánh dấu hàng đã xuất
   */
  static async markAsExported(warehouseItemIds, exportRecordId) {
    try {
      if (!Array.isArray(warehouseItemIds) || warehouseItemIds.length === 0) {
        throw new Error('Warehouse item IDs array required');
      }

      const placeholders = warehouseItemIds.map(() => '?').join(',');
      const params = [...warehouseItemIds, exportRecordId];

      await dbRun(
        `UPDATE warehouse_inventory 
         SET exported_at = CURRENT_TIMESTAMP, export_record_id = ?
         WHERE id IN (${placeholders})`,
        [exportRecordId, ...warehouseItemIds]
      );

      console.log(`✓ Marked ${warehouseItemIds.length} items as exported`);
      return { success: true, count: warehouseItemIds.length };
    } catch (error) {
      console.error('Error marking items as exported:', error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử xuất kho
   */
  static async getExportHistory() {
    try {
      const history = await dbAll(`
        SELECT 
          wi.id,
          wi.product_id,
          wi.item_type,
          wi.item_name,
          wi.item_description,
          wi.quantity,
          wi.added_at,
          wi.exported_at,
          wi.export_record_id,
          er.title as export_title,
          p.product_code,
          p.product_name
        FROM warehouse_inventory wi
        LEFT JOIN export_records er ON wi.export_record_id = er.id
        LEFT JOIN products p ON wi.product_id = p.id
        WHERE wi.exported_at IS NOT NULL
        ORDER BY wi.exported_at DESC
      `);

      return history;
    } catch (error) {
      console.error('Error getting export history:', error);
      throw error;
    }
  }

  /**
   * Kiểm tra sản phẩm đã hoàn thành tất cả stages chưa
   */
  static async checkProductCompletion(productId) {
    try {
      // Lấy tất cả stages đang active cho product này
      const activeStages = await dbAll(
        `SELECT stage_id, status, completed_at 
         FROM product_active_stages 
         WHERE product_id = ?`,
        [productId]
      );

      if (activeStages.length === 0) {
        return { isComplete: false, reason: 'No active stages' };
      }

      // Kiểm tra tất cả stages đã hoàn thành chưa
      const allCompleted = activeStages.every(stage => stage.status === 'completed');

      return {
        isComplete: allCompleted,
        totalStages: activeStages.length,
        completedStages: activeStages.filter(s => s.status === 'completed').length
      };
    } catch (error) {
      console.error('Error checking product completion:', error);
      throw error;
    }
  }

  /**
   * Tự động kiểm tra và đưa sản phẩm vào kho nếu hoàn thành
   */
  static async autoMoveToWarehouseIfComplete(productId) {
    try {
      const completion = await this.checkProductCompletion(productId);

      if (completion.isComplete) {
        await this.addProduct(productId);
        console.log(`✓ Product ${productId} auto-moved to warehouse`);
        return { moved: true };
      }

      return { moved: false, completion };
    } catch (error) {
      console.error('Error auto-moving to warehouse:', error);
      throw error;
    }
  }
}
