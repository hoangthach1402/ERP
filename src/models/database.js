import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = process.env.DB_PATH || join(__dirname, '../../database/manufacturing.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err);
  } else {
    console.log('✓ Database file opened');
    // Enable foreign keys and WAL mode
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA journal_mode = WAL');
    
    // Initialize tables immediately
    initializeTables().catch(err => {
      console.error('❌ Failed to initialize tables:', err);
    });
  }
});

db.configure('busyTimeout', 5000);

// Promise wrappers for database operations
export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// Auto-initialize tables
async function initializeTables() {
  try {
    // Check if users table exists
    const usersTableExists = await dbGet(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    );

    if (usersTableExists) {
      console.log('✓ Database tables already exist');

      const taskColumns = await dbAll("PRAGMA table_info(product_stage_tasks)");
      const hasNormHours = taskColumns.some(col => col.name === 'norm_hours');
      const hasPendingReason = taskColumns.some(col => col.name === 'pending_reason');

      if (!hasNormHours) {
        console.log('🔧 Adding norm_hours column to product_stage_tasks...');
        await dbRun('ALTER TABLE product_stage_tasks ADD COLUMN norm_hours INTEGER DEFAULT 0');
        console.log('✓ norm_hours column added');
      }

      if (!hasPendingReason) {
        console.log('🔧 Adding pending_reason column to product_stage_tasks...');
        await dbRun('ALTER TABLE product_stage_tasks ADD COLUMN pending_reason TEXT');
        console.log('✓ pending_reason column added');
      }
      
      // Ensure admin user exists
      const adminExists = await dbGet('SELECT id FROM users WHERE username = ?', ['admin']);
      if (adminExists) {
        console.log('✓ Admin user exists');
        return;
      }
    }

    console.log('🔧 Creating database tables...');

    // Create all tables
    await dbRun(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'RAP',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbRun(`
      CREATE TABLE stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stage_name TEXT UNIQUE NOT NULL,
        norm_hours INTEGER NOT NULL,
        sequence_order INTEGER NOT NULL,
        description TEXT
      )
    `);

    await dbRun(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_code TEXT UNIQUE NOT NULL,
        product_name TEXT NOT NULL,
        current_stage_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (current_stage_id) REFERENCES stages(id)
      )
    `);

    await dbRun(`
      CREATE TABLE product_stage_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        stage_id INTEGER NOT NULL,
        norm_hours INTEGER DEFAULT 0,
        pending_reason TEXT,
        assigned_user_id INTEGER,
        start_time DATETIME,
        end_time DATETIME,
        status TEXT DEFAULT 'pending',
        is_delayed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (stage_id) REFERENCES stages(id),
        FOREIGN KEY (assigned_user_id) REFERENCES users(id),
        UNIQUE(product_id, stage_id)
      )
    `);

    await dbRun(`
      CREATE TABLE activity_logs (
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

    console.log('✓ All tables created');

    // Insert stages
    const stagesList = [
      { name: 'RẬP', hours: 4, order: 1 },
      { name: 'CẮT', hours: 4, order: 2 },
      { name: 'MAY', hours: 6, order: 3 },
      { name: 'THIẾT_KẾ', hours: 6, order: 4 },
      { name: 'ĐÍNH_KẾT', hours: 12, order: 5 }
    ];

    for (const stage of stagesList) {
      await dbRun(
        'INSERT INTO stages (stage_name, norm_hours, sequence_order) VALUES (?, ?, ?)',
        [stage.name, stage.hours, stage.order]
      );
    }
    console.log('✓ Stages inserted');

    // Create admin user
    const hashedPassword = await bcryptjs.hash('admin123', 10);
    await dbRun(
      'INSERT INTO users (username, password, full_name, email, role, status) VALUES (?, ?, ?, ?, ?, ?)',
      ['admin', hashedPassword, 'Administrator', 'admin@manufacturing.local', 'ADMIN', 'active']
    );
    console.log('✓ Admin user created (username: admin, password: admin123)');
    console.log('✅ Database initialization completed!');
  } catch (error) {
    console.error('❌ Database error:', error.message);
    // Don't throw, let app continue - tables might already exist
  }
}

export default db;
