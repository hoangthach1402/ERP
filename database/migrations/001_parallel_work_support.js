import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = process.env.DB_PATH || join(__dirname, '../manufacturing.db');

const db = new sqlite3.Database(dbPath);

// Promise wrappers
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
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

async function migrate() {
  console.log('🚀 Starting migration: Parallel Work Support...');
  
  try {
    // Enable foreign keys
    await dbRun('PRAGMA foreign_keys = ON');
    
    // Step 1: Create product_active_stages table
    console.log('📦 Creating product_active_stages table...');
    await dbRun(`
      CREATE TABLE IF NOT EXISTS product_active_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        stage_id INTEGER NOT NULL,
        status TEXT DEFAULT 'active',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (stage_id) REFERENCES stages(id),
        UNIQUE(product_id, stage_id)
      )
    `);
    console.log('✅ product_active_stages table created');

    // Step 2: Create product_stage_workers table
    console.log('📦 Creating product_stage_workers table...');
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
    console.log('✅ product_stage_workers table created');

    // Step 3: Migrate existing data
    console.log('🔄 Migrating existing data...');
    
    // Migrate products with current_stage to product_active_stages
    const products = await dbAll(`
      SELECT DISTINCT p.id, p.current_stage_id, pst.start_time, pst.status
      FROM products p
      LEFT JOIN product_stage_tasks pst ON p.id = pst.product_id AND p.current_stage_id = pst.stage_id
      WHERE p.status != 'completed'
    `);

    for (const product of products) {
      // Check if already migrated
      const existing = await dbGet(
        'SELECT id FROM product_active_stages WHERE product_id = ? AND stage_id = ?',
        [product.id, product.current_stage_id]
      );

      if (!existing) {
        const stageStatus = product.status === 'completed' ? 'completed' : 'active';
        await dbRun(
          `INSERT INTO product_active_stages (product_id, stage_id, status, started_at) 
           VALUES (?, ?, ?, ?)`,
          [product.id, product.current_stage_id, stageStatus, product.start_time || new Date().toISOString()]
        );
        console.log(`  ✓ Migrated product ${product.id} - stage ${product.current_stage_id}`);
      }
    }

    // Migrate workers from product_stage_tasks
    const tasks = await dbAll(`
      SELECT pst.*, p.current_stage_id
      FROM product_stage_tasks pst
      JOIN products p ON pst.product_id = p.id
      WHERE pst.assigned_user_id IS NOT NULL
        AND pst.stage_id = p.current_stage_id
    `);

    for (const task of tasks) {
      // Check if already migrated
      const existing = await dbGet(
        'SELECT id FROM product_stage_workers WHERE product_id = ? AND stage_id = ? AND user_id = ?',
        [task.product_id, task.stage_id, task.assigned_user_id]
      );

      if (!existing) {
        const workerStatus = task.status === 'completed' ? 'completed' : 
                           task.status === 'processing' ? 'working' : 'assigned';
        
        const hoursWorked = task.end_time && task.start_time ? 
          (new Date(task.end_time) - new Date(task.start_time)) / (1000 * 60 * 60) : 0;

        await dbRun(
          `INSERT INTO product_stage_workers 
           (product_id, stage_id, user_id, status, start_time, end_time, hours_worked, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            task.product_id, 
            task.stage_id, 
            task.assigned_user_id, 
            workerStatus,
            task.start_time,
            task.end_time,
            hoursWorked,
            task.created_at
          ]
        );
        console.log(`  ✓ Migrated worker for product ${task.product_id} - stage ${task.stage_id} - user ${task.assigned_user_id}`);
      }
    }

    // Step 4: Create indexes for better performance
    console.log('📊 Creating indexes...');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_pas_product ON product_active_stages(product_id)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_pas_stage ON product_active_stages(stage_id)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_pas_status ON product_active_stages(status)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_psw_product_stage ON product_stage_workers(product_id, stage_id)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_psw_user ON product_stage_workers(user_id)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_psw_status ON product_stage_workers(status)');
    console.log('✅ Indexes created');

    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run migration
migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
