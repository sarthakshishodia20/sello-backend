const db = require('../database/mysqlLib');

/**
 * Tracks and logs any backend error to the `tb_errors` table in the database.
 * @param {Error|string} error - The JavaScript Error object or message
 * @param {Object} req - The Express Request object (optional)
 */
async function trackError(error, req = null) {
  try {
    const errorObj = error instanceof Error ? error : new Error(error);
    const errorMessage = errorObj.message || 'Unknown backend error';
    const errorStack = errorObj.stack || null;
    let endpoint = null;
    let method = null;
    let userId = null;

    if (req) {
      endpoint = req.originalUrl || req.url || null;
      method = req.method || null;
      
      // Extract authenticated user ID from req.selloUser or req.user
      const user = req.selloUser || req.user;
      if (user && user.id) {
        userId = user.id;
      }
    }

    const sql = `
      INSERT INTO tb_errors (error_message, error_stack, endpoint, method, user_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    // We execute the insert into db
    await db.query(sql, [errorMessage, errorStack, endpoint, method, userId]);
  } catch (trackingError) {
    // If inserting into tb_errors fails, print a warning in the console but do not crash the app
    console.error('[Error Tracker] ❌ Failed to insert error log to tb_errors:', trackingError.message);
  }
}

module.exports = { trackError };
