const db = require('../../../database/mysqlLib');

async function getAdminActivity(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const user = req.selloUser;

    if (user.role !== 'MASTERBRAND_ADMIN' && user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ status: 0, message: 'Forbidden' });
    }

    const mbId = user.masterbrandId || 1;
    const rows = await db.query(
      `SELECT a.*, u.name as user_name 
       FROM tb_masterbrand_activity a
       JOIN tb_users u ON a.user_id = u.id
       WHERE a.masterbrand_id = ?
       ORDER BY a.created_at DESC 
       LIMIT ? OFFSET ?`,
      [mbId, parseInt(limit), parseInt(offset)]
    );

    const totalRows = await db.query(
      `SELECT COUNT(*) as count FROM tb_masterbrand_activity WHERE masterbrand_id = ?`,
      [mbId]
    );

    res.json({ status: 1, data: rows, total: totalRows[0].count });
  } catch (err) {
    res.status(500).json({ status: 0, message: err.message });
  }
}

async function getMerchantActivity(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const user = req.selloUser;

    if (user.role !== 'MERCHANT_ADMIN') {
      return res.status(403).json({ status: 0, message: 'Forbidden' });
    }

    const rows = await db.query(
      `SELECT a.*, u.name as user_name 
       FROM tb_merchant_activity a
       JOIN tb_users u ON a.user_id = u.id
       WHERE a.merchant_id = ?
       ORDER BY a.created_at DESC 
       LIMIT ? OFFSET ?`,
      [user.merchantId, parseInt(limit), parseInt(offset)]
    );

    const totalRows = await db.query(
      `SELECT COUNT(*) as count FROM tb_merchant_activity WHERE merchant_id = ?`,
      [user.merchantId]
    );

    res.json({ status: 1, data: rows, total: totalRows[0].count });
  } catch (err) {
    res.status(500).json({ status: 0, message: err.message });
  }
}

module.exports = { getAdminActivity, getMerchantActivity };
