import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcryptjs from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '../../database/manufacturing.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database at', dbPath);
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Helper function to run queries with promises
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize tables
async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    // Users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE,
        role TEXT NOT NULL CHECK(role IN ('RAP', 'CAT', 'MAY', 'THIET_KE', 'DINH_KET', 'KCS', 'ADMIN', 'THU_MUA')),
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Stages (công đoạn) definition table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stage_name TEXT UNIQUE NOT NULL,
        norm_hours INTEGER NOT NULL,
        sequence_order INTEGER NOT NULL,
        description TEXT
      )
    `);

    // Products table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_code TEXT UNIQUE NOT NULL,
        product_name TEXT NOT NULL,
        current_stage_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'delayed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (current_stage_id) REFERENCES stages(id)
      )
    `);

    // Product Stage Tasks - tracks each product through each stage
    await dbRun(`
      CREATE TABLE IF NOT EXISTS product_stage_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        stage_id INTEGER NOT NULL,
        pending_reason TEXT,
        assigned_user_id INTEGER,
        start_time DATETIME,
        end_time DATETIME,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed')),
        is_delayed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (stage_id) REFERENCES stages(id),
        FOREIGN KEY (assigned_user_id) REFERENCES users(id),
        UNIQUE(product_id, stage_id)
      )
    `);

    // Activity Logs - detailed logs of all actions
    await dbRun(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER,
        stage_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (stage_id) REFERENCES stages(id)
      )
    `);

    // Material Requests - yêu cầu mua nguyên vật liệu
    await dbRun(`
      CREATE TABLE IF NOT EXISTS material_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        stage_id INTEGER NOT NULL,
        requested_by_user_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'purchased', 'delivered')),
        purchased_by_user_id INTEGER,
        purchased_at DATETIME,
        expected_delivery_date DATE,
        delivered_at DATETIME,
        response_note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (stage_id) REFERENCES stages(id),
        FOREIGN KEY (requested_by_user_id) REFERENCES users(id),
        FOREIGN KEY (purchased_by_user_id) REFERENCES users(id)
      )
    `);

    // Material Request Messages - tin nhắn chat trong yêu cầu
    await dbRun(`
      CREATE TABLE IF NOT EXISTS material_request_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES material_requests(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Product active stages (multi-stage)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS product_active_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        stage_id INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        norm_hours INTEGER,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (stage_id) REFERENCES stages(id),
        UNIQUE(product_id, stage_id)
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS product_stage_workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        stage_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'assigned',
        start_time DATETIME,
        end_time DATETIME,
        hours_worked REAL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (stage_id) REFERENCES stages(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(product_id, stage_id, user_id)
      )
    `);

    // Export records (biên bản xuất xưởng)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS export_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        shipping_address TEXT NOT NULL,
        approved_by TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS export_record_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        product_note TEXT,
        FOREIGN KEY (record_id) REFERENCES export_records(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS export_record_custom_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        item_type TEXT NOT NULL CHECK(item_type IN ('document', 'personal', 'misc')),
        item_name TEXT NOT NULL,
        item_description TEXT,
        quantity INTEGER DEFAULT 1,
        FOREIGN KEY (record_id) REFERENCES export_records(id) ON DELETE CASCADE
      )
    `);

    // Inbound records (nhập hàng)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS inbound_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        description TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS inbound_record_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        stage_id INTEGER NOT NULL,
        norm_hours INTEGER NOT NULL,
        FOREIGN KEY (record_id) REFERENCES inbound_records(id) ON DELETE CASCADE,
        FOREIGN KEY (stage_id) REFERENCES stages(id)
      )
    `);

    // Warehouse Inventory (Kho hàng hoàn thành)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS warehouse_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        item_type TEXT NOT NULL DEFAULT 'product' CHECK(item_type IN ('product', 'document', 'personal', 'misc')),
        item_name TEXT,
        item_description TEXT,
        quantity INTEGER DEFAULT 1,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        exported_at DATETIME,
        export_record_id INTEGER,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (export_record_id) REFERENCES export_records(id)
      )
    `);

    const usersTable = await dbGet("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'");
    const usersTableSql = usersTable?.sql || '';
    if (!usersTableSql.includes("'KCS'")) {
      console.log('↻ Updating users role constraint to include KCS...');
      await dbRun('PRAGMA foreign_keys = OFF');
      await dbRun('BEGIN TRANSACTION');
      try {
        await dbRun(`
          CREATE TABLE IF NOT EXISTS users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            email TEXT UNIQUE,
            role TEXT NOT NULL CHECK(role IN ('RAP', 'CAT', 'MAY', 'THIET_KE', 'DINH_KET', 'KCS', 'ADMIN', 'THU_MUA')),
            status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await dbRun(`
          INSERT INTO users_new (id, username, password, full_name, email, role, status, created_at, updated_at)
          SELECT id, username, password, full_name, email, role, status, created_at, updated_at
          FROM users
        `);

        await dbRun('DROP TABLE users');
        await dbRun('ALTER TABLE users_new RENAME TO users');
        await dbRun('COMMIT');
        await dbRun('PRAGMA foreign_keys = ON');
        console.log('✓ Users role constraint updated');
      } catch (error) {
        await dbRun('ROLLBACK');
        await dbRun('PRAGMA foreign_keys = ON');
        throw error;
      }
    }

    console.log('✓ Tables created successfully');

    // Insert stages/công đoạn
    const stagesList = [
      { name: 'RẬP', hours: 4, order: 1, desc: 'Khâu rập - Chuẩn bị vải' },
      { name: 'CẮT', hours: 4, order: 2, desc: 'Khâu cắt - Cắt vải theo mẫu' },
      { name: 'MAY', hours: 6, order: 3, desc: 'Khâu may - May chính và may phụ' },
      { name: 'THIẾT KẾ', hours: 6, order: 4, desc: 'Khâu thiết kế đắp' },
      { name: 'ĐÍNH KẾT', hours: 12, order: 5, desc: 'Khâu đính kết - Hoàn thiện' }
    ];

    for (const stage of stagesList) {
      const existing = await dbGet('SELECT id FROM stages WHERE stage_name = ?', [stage.name]);
      if (!existing) {
        await dbRun(
          'INSERT INTO stages (stage_name, norm_hours, sequence_order, description) VALUES (?, ?, ?, ?)',
          [stage.name, stage.hours, stage.order, stage.desc]
        );
        console.log(`✓ Stage created: ${stage.name}`);
      }
    }

    // Insert default admin user
    const adminExists = await dbGet('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!adminExists) {
      const hashedPassword = await bcryptjs.hash('admin123', 10);
      await dbRun(
        'INSERT INTO users (username, password, full_name, email, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        ['admin', hashedPassword, 'Administrator', 'admin@manufacturing.local', 'ADMIN', 'active']
      );
      console.log('✓ Default admin user created (username: admin, password: admin123)');
    }

    // Insert default purchasing user
    const purchasingExists = await dbGet('SELECT id FROM users WHERE username = ?', ['thumua']);
    if (!purchasingExists) {
      const hashedPassword = await bcryptjs.hash('thumua123', 10);
      await dbRun(
        'INSERT INTO users (username, password, full_name, email, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        ['thumua', hashedPassword, 'Nhân viên Thu Mua', 'thumua@manufacturing.local', 'THU_MUA', 'active']
      );
      console.log('✓ Default purchasing user created (username: thumua, password: thumua123)');
    }

    console.log('✓ Database initialization completed');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase();

export { db, dbRun, dbGet, dbAll };
