/**
 * Sello — Backend Server
 * Entry point: app.js
 */

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const { activityLogger } = require('./middlewares/activityLogger');
const logger     = require('./utilities/loggingUtil');

// ─── Initialize App ────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 4000;

// Trust proxy for correct IP detection in activity logs
app.set('trust proxy', true);

// ─── Initialize Database ───────────────────────────────────────────────────
const db = require('./database/mysqlLib');
db.initialize();

// ─── CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: true, // Dynamically mirror requesting origin to seamlessly authorize all live Render frontends
  credentials: true
}));

// ─── Body Parsers ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static Files (uploaded images) ────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// ─── Request Trace Logger ───────────────────────────────────────────────────
app.use((req, res, next) => {
  const store = {
    reqId: Math.random().toString(36).slice(2, 9).toUpperCase(),
    method: req.method,
    url: req.originalUrl,
    startTime: Date.now()
  };

  logger.getStorage().run(store, () => {
    logger.info('API', 'REQUEST_START', {
      reqId: store.reqId,
      method: req.method,
      url: req.originalUrl,
      body: req.body
    });

    const originalSend = res.send;
    res.send = function (body) {
      const duration = Date.now() - store.startTime;
      let parsedBody = body;
      try {
        parsedBody = JSON.parse(body);
      } catch (e) {}

      logger.info('API', 'REQUEST_COMPLETE', {
        reqId: store.reqId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        response: parsedBody
      });

      return originalSend.apply(res, arguments);
    };

    next();
  });
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

const { trackError } = require('./utilities/errorTracker');

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(async (err, req, res, next) => {
  console.error('[Sello Error]', err.message || err);
  
  // Track this unhandled exception to tb_errors table
  await trackError(err, req);

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
