import { dbGet, dbAll, dbRun } from './database.js';

export class InboundRecord {
  static async create({ product_id, description, created_by, stages }) {
    await dbRun('BEGIN TRANSACTION');
    try {
      const result = await dbRun(
        `INSERT INTO inbound_records (product_id, description, created_by)
         VALUES (?, ?, ?)`,
        [product_id, description || null, created_by]
      );

      const recordId = result.lastID;
      for (const stage of stages) {
        await dbRun(
          `INSERT INTO inbound_record_stages (record_id, stage_id, norm_hours)
           VALUES (?, ?, ?)`,
          [recordId, stage.stage_id, stage.norm_hours]
        );
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
      SELECT ir.*, p.product_code, p.product_name, u.full_name as created_by_name,
             COUNT(irs.id) as stage_count
      FROM inbound_records ir
      LEFT JOIN products p ON ir.product_id = p.id
      LEFT JOIN users u ON ir.created_by = u.id
      LEFT JOIN inbound_record_stages irs ON ir.id = irs.record_id
      GROUP BY ir.id
      ORDER BY ir.created_at DESC
    `);
  }

  static async getById(recordId) {
    const record = await dbGet(`
      SELECT ir.*, p.product_code, p.product_name, u.full_name as created_by_name
      FROM inbound_records ir
      LEFT JOIN products p ON ir.product_id = p.id
      LEFT JOIN users u ON ir.created_by = u.id
      WHERE ir.id = ?
    `, [recordId]);

    if (!record) return null;

    const stages = await dbAll(`
      SELECT irs.*, s.stage_name
      FROM inbound_record_stages irs
      LEFT JOIN stages s ON irs.stage_id = s.id
      WHERE irs.record_id = ?
      ORDER BY s.sequence_order ASC
    `, [recordId]);

    return { ...record, stages };
  }
}

export default InboundRecord;
