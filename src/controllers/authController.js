import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).render('login', { error: 'Username and password required' });
    }

    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(401).render('login', { error: 'Invalid username or password' });
    }

    const isValid = await User.verifyPassword(user, password);
    if (!isValid) {
      return res.status(401).render('login', { error: 'Invalid username or password' });
    }

    if (user.status === 'inactive') {
      return res.status(403).render('login', { error: 'Your account has been disabled' });
    }

    // Generate token
    const token = generateToken(user.id);

    // Store in session
    req.session.token = token;
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    };

    console.log(`✓ User ${username} logged in with role: ${user.role}`);
    
    // Save session before redirect
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).render('login', { error: 'Session error' });
      }
      res.redirect('/');
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).render('login', { error: 'Server error' });
  }
};

export const logout = (req, res) => {
  const user = req.session?.user?.username || 'Unknown';
  console.log(`User ${user} logged out`);
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    // Redirect to root which will show login page
    res.redirect('/');
  });
};

export const loginPage = (req, res) => {
  // If user is already logged in, redirect to appropriate dashboard
  if (req.session?.token && req.session?.user) {
    const role = req.session.user.role?.toUpperCase();
    console.log(`LoginPage: Already logged in as ${req.session.user.username} (${role}), redirecting to dashboard`);
    
    if (role === 'ADMIN') {
      return res.redirect('/workflow/multi-stage-dashboard');
    } else if (role === 'THU_MUA') {
      return res.redirect('/purchasing/dashboard');
    } else {
      return res.redirect('/workflow/worker-dashboard');
    }
  }
  
  // Not logged in, show login page
  res.render('login', { error: null });
};

export default { login, logout, loginPage };
