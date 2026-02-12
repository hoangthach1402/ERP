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

    console.log(`✓ User ${username} logged in`);
    res.redirect('/product/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).render('login', { error: 'Server error' });
  }
};

export const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.redirect('/');
  });
};

export const loginPage = (req, res) => {
  if (req.session?.token) {
    return res.redirect('/product/dashboard');
  }
  res.render('login', { error: null });
};

export default { login, logout, loginPage };
