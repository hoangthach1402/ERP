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
        role TEXT NOT NULL CHECK(role IN ('RAP', 'CAT', 'MAY', 'THIET_KE', 'DINH_KET', 'ADMIN', 'THU_MUA')),
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
