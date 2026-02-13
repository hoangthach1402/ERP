/**
 * Input validation middleware for user creation and management
 * Prevents security vulnerabilities and data corruption
 */

// Validate user creation request
export const validateUserCreation = (req, res, next) => {
  try {
    const { username, password, full_name, email, role } = req.body;

    // Check required fields
    if (!username || !password || !full_name || !role) {
      return res.status(400).json({ error: 'Missing required fields: username, password, full_name, role' });
    }

    // Validate username - alphanumeric only, 3-30 characters
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({ 
        error: 'Username must be 3-30 characters and contain only letters, numbers, or underscores' 
      });
    }

    // Validate password - minimum 8 characters, must contain uppercase, lowercase, number
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one lowercase letter' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one number' });
    }

    // Validate full name - allow letters, spaces, common Vietnamese characters
    if (!/^[a-zA-ZÀ-ỿ\s]{2,100}$/.test(full_name.trim())) {
      return res.status(400).json({ 
        error: 'Full name must be 2-100 characters and contain only letters and spaces' 
      });
    }

    // Validate email if provided
    if (email && email.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email) || email.length > 255) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
    }

    // Validate role - only allowed roles
    const allowedRoles = ['RAP', 'CAT', 'MAY', 'THIET_KE', 'DINH_KET', 'KCS', 'ADMIN', 'THU_MUA'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}` });
    }

    // Sanitize inputs - trim whitespace
    req.body.username = username.trim();
    req.body.full_name = full_name.trim();
    req.body.email = email ? email.trim().toLowerCase() : '';
    req.body.role = role.trim();

    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Validation error occurred' });
  }
};

// Validate user role update request
export const validateRoleUpdate = (req, res, next) => {
  try {
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing required fields: userId, role' });
    }

    if (!/^\d+$/.test(String(userId))) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const allowedRoles = ['RAP', 'CAT', 'MAY', 'THIET_KE', 'DINH_KET', 'KCS', 'ADMIN', 'THU_MUA'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Allowed roles: ${allowedRoles.join(', ')}` });
    }

    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Validation error occurred' });
  }
};

// Validate user deactivation request
export const validateUserDeactivation = (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing required field: userId' });
    }

    if (!/^\d+$/.test(String(userId))) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Validation error occurred' });
  }
};

export default {
  validateUserCreation,
  validateRoleUpdate,
  validateUserDeactivation
};
