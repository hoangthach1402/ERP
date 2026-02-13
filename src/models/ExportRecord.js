import { dbGet, dbAll, dbRun } from './database.js';

export class ExportRecord {
  static async create({ title, description, shipping_address, approved_by, created_by, warehouseItemIds, customItems }) {
    await dbRun('BEGIN TRANSACTION');
    try {
      const result = await dbRun(
        `INSERT INTO export_records (title, description, shipping_address, approved_by, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [title, description || null, shipping_address, approved_by || null, created_by]
      );

      const recordId = result.lastID;

      // Thêm warehouse items vào export_record_items hoặc export_record_custom_items
      if (warehouseItemIds && warehouseItemIds.length > 0) {
        for (const itemId of warehouseItemIds) {
          const warehouseItem = await dbGet(
            'SELECT * FROM warehouse_inventory WHERE id = ?',
            [itemId]
          );
          
          if (warehouseItem) {
            if (warehouseItem.product_id) {
              // Sản phẩm thực tế
              await dbRun(
                `INSERT INTO export_record_items (record_id, product_id, product_note)
                 VALUES (?, ?, ?)`,
                [recordId, warehouseItem.product_id, null]
              );
            } else {
              // Custom item (hồ sơ, đồ dùng cá nhân, etc.)
              await dbRun(
                `INSERT INTO export_record_custom_items (record_id, item_type, item_name, item_description, quantity)
                 VALUES (?, ?, ?, ?, ?)`,
                [recordId, warehouseItem.item_type, warehouseItem.item_name, warehouseItem.item_description, warehouseItem.quantity || 1]
              );
            }
          }
        }
      }

      // Thêm custom items (hồ sơ, đồ dùng cá nhân)
      if (customItems && customItems.length > 0) {
        for (const item of customItems) {
          await dbRun(
            `INSERT INTO export_record_custom_items (record_id, item_type, item_name, item_description, quantity)
             VALUES (?, ?, ?, ?, ?)`,
            [recordId, item.item_type, item.item_name, item.item_description || null, item.quantity || 1]
          );
        }
      }

      await dbRun('COMMIT');
      return this.getById(recordId);
    } catch (error) {
      await dbRun('ROLLBACK');
      throw error;
    }
  }

  static async getAll() {
    return dbAll(`
      SELECT er.*, u.full_name as created_by_name,
             COUNT(eri.id) as total_items
      FROM export_records er
      LEFT JOIN users u ON er.created_by = u.id
      LEFT JOIN export_record_items eri ON er.id = eri.record_id
      GROUP BY er.id
      ORDER BY er.created_at DESC
    `);
  }

  static async getById(recordId) {
    const record = await dbGet(`
      SELECT er.*, u.full_name as created_by_name
      FROM export_records er
      LEFT JOIN users u ON er.created_by = u.id
      WHERE er.id = ?
    `, [recordId]);

    if (!record) return null;

    const items = await dbAll(`
      SELECT eri.*, p.product_code, p.product_name
      FROM export_record_items eri
      LEFT JOIN products p ON eri.product_id = p.id
      WHERE eri.record_id = ?
      ORDER BY eri.id ASC
    `, [recordId]);

    const customItems = await dbAll(`
      SELECT * FROM export_record_custom_items
      WHERE record_id = ?
      ORDER BY id ASC
    `, [recordId]);

    return { ...record, items, customItems };
  }
}

export default ExportRecord;
