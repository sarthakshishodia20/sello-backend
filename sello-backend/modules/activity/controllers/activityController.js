const db = require('../../../database/mysqlLib');
const logger = require('../../../utilities/loggingUtil');

const MODULE = 'ActivityController';

async function getAdminActivity(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const user = req.selloUser;

    if (user.role !== 'MASTERBRAND_ADMIN' && user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ status: 0, message: 'Forbidden' });
    }

    const mbId = user.masterbrandId || 1;
    
    // Fetch count first
    const totalRows = await db.query(
      `SELECT COUNT(*) as count FROM tb_masterbrand_activity WHERE masterbrand_id = ?`,
      [mbId]
    );

    // Optimized Fetch: We exclude request_data and response_data from the list view to save memory
    // Those fields are huge and cause the 'Out of sort memory' error when sorting by date.
    const rows = await db.query(
      `SELECT 
        a.id, 
        a.action, 
        a.endpoint, 
        a.method, 
        a.ip_address, 
        a.created_at, 
        u.name as user_name 
       FROM tb_masterbrand_activity a
       LEFT JOIN tb_users u ON a.user_id = u.id
       WHERE a.masterbrand_id = ?
       ORDER BY a.id DESC 
       LIMIT ? OFFSET ?`,
      [mbId, parseInt(limit), offset]
    );

    res.json({ status: 1, data: rows, total: totalRows[0].count });
  } catch (err) {
    logger.error(MODULE, 'GET_ADMIN_ACTIVITY_ERROR', { error: err.message });
    next(err);
  }
}

async function getMerchantActivity(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const user = req.selloUser;

    if (user.role !== 'MERCHANT_ADMIN') {
      return res.status(403).json({ status: 0, message: 'Forbidden' });
    }

    const totalRows = await db.query(
      `SELECT COUNT(*) as count FROM tb_merchant_activity WHERE merchant_id = ?`,
      [user.merchantId]
    );

    const rows = await db.query(
      `SELECT 
        a.id, 
        a.action, 
        a.endpoint, 
        a.method, 
        a.ip_address, 
        a.created_at, 
        u.name as user_name 
       FROM tb_merchant_activity a
       LEFT JOIN tb_users u ON a.user_id = u.id
       WHERE a.merchant_id = ?
       ORDER BY a.id DESC 
       LIMIT ? OFFSET ?`,
      [user.merchantId, parseInt(limit), offset]
    );

    res.json({ status: 1, data: rows, total: totalRows[0].count });
  } catch (err) {
    logger.error(MODULE, 'GET_MERCHANT_ACTIVITY_ERROR', { error: err.message });
    next(err);
  }
}

module.exports = { getAdminActivity, getMerchantActivity };
