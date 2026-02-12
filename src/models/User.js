import { dbGet, dbAll, dbRun } from './database.js';
import bcryptjs from 'bcryptjs';

// User model
export class User {
  static async findById(id) {
    return dbGet('SELECT id, username, full_name, email, role, status, created_at FROM users WHERE id = ?', [id]);
  }

  static async findByUsername(username) {
    return dbGet('SELECT * FROM users WHERE username = ?', [username]);
  }

  static async create(userData) {
    const { username, password, full_name, email, role } = userData;
    const hashedPassword = await bcryptjs.hash(password, 10);
    
    const result = await dbRun(
      'INSERT INTO users (username, password, full_name, email, role) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, full_name, email, role]
    );
    
    return this.findById(result.lastID);
  }

  static async verifyPassword(user, password) {
    return bcryptjs.compare(password, user.password);
  }

  static async getAll() {
    return dbAll('SELECT id, username, full_name, email, role, status, created_at FROM users ORDER BY created_at DESC');
  }

  static async updateRole(userId, role) {
    await dbRun('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [role, userId]);
    return this.findById(userId);
  }

  static async updateStatus(userId, status) {
    await dbRun('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, userId]);
    return this.findById(userId);
  }

  static async getByRole(role) {
    return dbAll('SELECT id, username, full_name, email, role, status FROM users WHERE role = ? AND status = "active"', [role]);
  }
}

export default User;
