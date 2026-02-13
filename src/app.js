import express from 'express';
import session from 'express-session';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Import routes
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import scanRoutes from './routes/scanRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import purchasingRoutes from './routes/purchasingRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security and logging middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://cdnjs.cloudflare.com'],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
    }
  }
}));
app.use(cors());

// Custom morgan format to sanitize sensitive data
morgan.token('sanitized-url', (req) => {
  const url = req.originalUrl || req.url;
  const sensitiveParams = ['password', 'token', 'secret', 'api_key'];
  
  try {
    const urlObj = new URL(url, `http://${req.hostname}`);
    let hasChanges = false;
    
    for (const param of sensitiveParams) {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
        hasChanges = true;
      }
    }
    
    return hasChanges ? urlObj.pathname + urlObj.search : url;
  } catch (e) {
    return url;
  }
});

app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :sanitized-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'));

// Security middleware: Block requests with sensitive data in URL
app.use((req, res, next) => {
  const sensitiveParams = ['password', 'token', 'secret'];
  
  for (const param of sensitiveParams) {
    if (req.query[param] && req.query[param].length > 0) {
      console.warn(`⚠️ SECURITY WARNING: Sensitive parameter '${param}' detected in URL from ${req.ip}`);
      return res.status(400).json({ 
        error: 'Security violation: sensitive data cannot be sent via URL parameters' 
      });
    }
  }
  
  next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // Allow HTTP for development
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', join(__dirname, '../views'));

// Static files
app.use(express.static(join(__dirname, '../public')));

// Local variables for views
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.method = req.method;
  next();
});

// Initialize database if it doesn't exist
const dbPath = process.env.DB_PATH || './database/manufacturing.db';
async function initializeDatabase() {
  try {
    console.log('📊 Ensuring database schema is up-to-date...');
    const { execSync } = await import('child_process');
    execSync('node src/models/initDatabase.js', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✓ Database schema verified/initialized successfully');
  } catch (error) {
    console.error('⚠️ Database initialization warning:', error.message);
    console.log('Continuing anyway - database tables will be created on first use');
  }
}

// Routes
app.use('/', authRoutes);
app.use('/product', productRoutes);
app.use('/scan', scanRoutes);
app.use('/admin', adminRoutes);
app.use('/purchasing', purchasingRoutes);
app.use('/workflow', workflowRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { error: 'Page not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).render('error', { error: 'Server error' });
});

// Start server
async function start() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`\n✓ Manufacturing ERP Server running on http://localhost:${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ Database: ${dbPath}\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;
