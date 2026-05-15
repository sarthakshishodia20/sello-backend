/**
 * Sello — Backend Server
 * Entry point: app.js
 */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const { activityLogger } = require('./middlewares/activityLogger');

// ─── Initialize App ────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 4000;

// Trust proxy for correct IP detection in activity logs
app.set('trust proxy', true);

// ─── Initialize Database ───────────────────────────────────────────────────
const db = require('./database/mysqlLib');
db.initialize();

// ─── CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:4200,http://localhost:4201').split(',');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));

// ─── Body Parsers ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static Files (uploaded images) ────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// ─── Request Logger ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Apply activity logger globally (will only log if user is authenticated)
app.use(activityLogger);

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 1, message: 'Sello API is running', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./modules/auth/index'));
app.use('/api/catalog',   require('./modules/catalog/index'));
app.use('/api/products',  require('./modules/products/index'));
app.use('/api/orders',    require('./modules/orders/index'));
app.use('/api/merchants', require('./modules/merchants/index'));
app.use('/api/webapp',    require('./modules/webapp/index'));
app.use('/api/notifications', require('./modules/notifications/index'));
app.use('/api/activity',  require('./modules/activity/index'));

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ status: 0, message: `Route not found: ${req.method} ${req.path}`, data: {} });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Sello Error]', err.message);
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ status: 0, message: err.message, data: {} });
  }
  res.status(500).json({ status: 0, message: 'Internal server error', data: {} });
});

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nSelo backend running at http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`API:    http://localhost:${PORT}/api\n`);
});

module.exports = app;
