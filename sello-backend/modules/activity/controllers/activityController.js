const db                                       = require('../../../database/mysqlLib');
const { sendSuccess, sendForbidden }           = require('../../../utilities/responseUtil');
const logger                                   = require('../../../utilities/loggingUtil');

const MODULE = 'ActivityController';

// ─── Admin Activity ───────────────────────────────────────────────────────────

async function getAdminActivity(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const user   = req.selloUser;

    if (user.role !== 'MASTERBRAND_ADMIN' && user.role !== 'SUPER_ADMIN') {
      return sendForbidden(res, 'You do not have permission to view admin activity');
    }

    const mbId = user.masterbrandId || 1;

    const totalRows = await db.query(
      `SELECT COUNT(*) as count FROM tb_masterbrand_activity WHERE masterbrand_id = ?`,
      [mbId]
    );

    // Optimised fetch: exclude request_data / response_data from list view to avoid sort-memory errors
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

    return sendSuccess(res, 'Admin activity fetched', { data: rows, total: totalRows[0].count });
  } catch (err) {
    logger.error(MODULE, 'GET_ADMIN_ACTIVITY_ERROR', { error: err.message });
    next(err);
  }
}

// ─── Merchant Activity ────────────────────────────────────────────────────────

async function getMerchantActivity(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const user   = req.selloUser;

    if (user.role !== 'MERCHANT_ADMIN') {
      return sendForbidden(res, 'You do not have permission to view merchant activity');
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

    return sendSuccess(res, 'Merchant activity fetched', { data: rows, total: totalRows[0].count });
  } catch (err) {
    logger.error(MODULE, 'GET_MERCHANT_ACTIVITY_ERROR', { error: err.message });
    next(err);
  }
}

async function getActivityDetail(req, res, next) {
  try {
    const { id } = req.params;
    const user = req.selloUser;

    if (user.role === 'MASTERBRAND_ADMIN' || user.role === 'SUPER_ADMIN') {
      const rows = await db.query(
        `SELECT a.*, u.name as user_name 
         FROM tb_masterbrand_activity a
         LEFT JOIN tb_users u ON a.user_id = u.id
         WHERE a.id = ? AND a.masterbrand_id = ?
         LIMIT 1`,
        [id, user.masterbrandId || 1]
      );
      if (rows.length === 0) {
        return sendForbidden(res, 'Activity log not found or access denied');
      }
      return sendSuccess(res, 'Admin activity detail fetched', rows[0]);
    } else if (user.role === 'MERCHANT_ADMIN') {
      const rows = await db.query(
        `SELECT a.*, u.name as user_name 
         FROM tb_merchant_activity a
         LEFT JOIN tb_users u ON a.user_id = u.id
         WHERE a.id = ? AND a.merchant_id = ?
         LIMIT 1`,
        [id, user.merchantId]
      );
      if (rows.length === 0) {
        return sendForbidden(res, 'Activity log not found or access denied');
      }
      return sendSuccess(res, 'Merchant activity detail fetched', rows[0]);
    } else {
      return sendForbidden(res, 'You do not have permission to view activity details');
    }
  } catch (err) {
    logger.error(MODULE, 'GET_ACTIVITY_DETAIL_ERROR', { error: err.message });
    next(err);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { getAdminActivity, getMerchantActivity, getActivityDetail };
