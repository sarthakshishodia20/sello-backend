const db = require('../database/mysqlLib');

/**
 * Middleware: Log all data-changing API activities (POST, PUT, DELETE)
 */
async function activityLogger(req, res, next) {
  // Log all authenticated requests as per user requirement for security auditing
  // (We check for req.selloUser later in the finish event)

  // Intercept the response to log response status/data if needed
  const originalSend = res.send;
  res.send = function (data) {
    res.locals.responseData = data;
    return originalSend.apply(res, arguments);
  };

  res.on('finish', async () => {
    try {
      const user = req.selloUser;
      if (!user) return;

      console.log(`[ActivityLog] ${req.method} ${req.originalUrl} - User: ${user.email} (${user.role})`);

      const action = `${req.method}_${req.path.split('/').pop().toUpperCase()}`;
      const endpoint = req.originalUrl;
      const method = req.method;
      const requestData = JSON.stringify(req.body);
      const responseData = typeof res.locals.responseData === 'string' 
        ? res.locals.responseData 
        : JSON.stringify(res.locals.responseData);
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      if (user.role === 'MASTERBRAND_ADMIN' || user.role === 'SUPER_ADMIN') {
        const mbId = user.masterbrandId || 1;
        await db.query(
          `INSERT INTO tb_masterbrand_activity 
          (masterbrand_id, user_id, action, endpoint, method, request_data, response_data, ip_address) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [mbId, user.id, action, endpoint, method, requestData, responseData, ipAddress]
        );
      } else if (user.role === 'MERCHANT_ADMIN') {
        if (user.merchantId) {
          await db.query(
            `INSERT INTO tb_merchant_activity 
            (merchant_id, user_id, action, endpoint, method, request_data, response_data, ip_address) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user.merchantId, user.id, action, endpoint, method, requestData, responseData, ipAddress]
          );
        }
      }
    } catch (err) {
      console.error('[ActivityLogger Error]', err.message);
    }
  });

  next();
}

module.exports = { activityLogger };
