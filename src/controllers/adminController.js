import User from '../models/User.js';
import { ProductStageTask } from '../models/Stage.js';
import ActivityLog from '../models/ActivityLog.js';

export const getAdminDashboard = async (req, res) => {
  try {
    // Block if any query parameters contain sensitive data
    if (Object.keys(req.query).length > 0) {
      const sensitiveParams = ['password', 'token', 'secret'];
      const hasSensitive = sensitiveParams.some(param => 
        req.query[param] && req.query[param].length > 0
      );
      
      if (hasSensitive) {
        console.warn('SECURITY WARNING: Sensitive data detected in query parameters from IP:', req.ip);
        return res.status(400).render('error', { 
          error: 'Invalid request: sensitive data cannot be sent as URL parameters' 
        });
      }
    }

    const users = await User.getAll();
    const delayedTasks = await ProductStageTask.getDelayedTasks();

    res.render('admin/dashboard', {
      users,
      delayedTasks,
      user: req.session.user,
      role: req.user.role
    });
  } catch (error) {
    console.error('Admin dashboard error:', error.message);
    res.status(500).render('error', { error: 'Error loading admin dashboard' });
  }
};

export const createUser = async (req, res) => {
  try {
    const { username, password, full_name, email, role } = req.body;

    // Additional security check - verify no sensitive data in URL
    if (Object.keys(req.query).length > 0) {
      return res.status(400).json({ error: 'Invalid request format. Use POST body only.' });
    }

    const user = await User.create({
      username,
      password,
      full_name,
      email,
      role
    });

    // Log WITHOUT password
    await ActivityLog.log(req.user.id, 'CREATE_USER', {
      username,
      role,
      email
    });

    // Return user data WITHOUT password
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Create user error:', error.message);
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Error creating user' });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { userId, role } = req.body;

    const user = await User.updateRole(userId, role);

    await ActivityLog.log(req.user.id, 'UPDATE_USER_ROLE', {
      targetUser: userId,
      newRole: role
    });

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Update user error:', error.message);
    res.status(500).json({ error: 'Error updating user role' });
  }
};

export const deactivateUser = async (req, res) => {
  try {
    const { userId } = req.body;

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const user = await User.updateStatus(userId, 'inactive');

    await ActivityLog.log(req.user.id, 'DEACTIVATE_USER', {
      targetUser: userId
    });

    res.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Deactivate user error:', error.message);
    res.status(500).json({ error: 'Error deactivating user' });
  }
};

export default {
  getAdminDashboard,
  createUser,
  updateUserRole,
  deactivateUser
};
