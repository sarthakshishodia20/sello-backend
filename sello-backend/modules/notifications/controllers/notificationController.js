const db = require('../../../database/mysqlLib');

async function getHistory(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const user = req.selloUser;

    let query = `SELECT * FROM tb_notification_received WHERE `;
    let countQuery = `SELECT COUNT(*) as count FROM tb_notification_received WHERE `;
    let params = [];
    let countParams = [];

    if (user.role === 'MASTERBRAND_ADMIN' || user.role === 'SUPER_ADMIN') {
      const cond = `(user_id = ? OR (user_id IS NULL AND merchant_id IS NULL))`;
      query += cond;
      countQuery += cond;
      params.push(user.id);
      countParams.push(user.id);
    } else {
      const cond = `merchant_id = ?`;
      query += cond;
      countQuery += cond;
      params.push(user.merchantId);
      countParams.push(user.merchantId);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const rows = await db.query(query, params);
    const totalRows = await db.query(countQuery, countParams);

    res.json({ status: 1, data: rows, total: totalRows[0].count });
  } catch (err) {
    next(err);
  }
}

async function getTemplates(req, res, next) {
  try {
    const user = req.selloUser;
    let rows;
    if (user.role === 'MASTERBRAND_ADMIN' || user.role === 'SUPER_ADMIN') {
      rows = await db.query(`
        SELECT * FROM (
          SELECT *,
            ROW_NUMBER() OVER (
              PARTITION BY event_type
              ORDER BY masterbrand_id DESC
            ) as rank_val
          FROM tb_notification_templates
          WHERE masterbrand_id = ? OR (masterbrand_id IS NULL AND merchant_id IS NULL)
        ) t WHERE rank_val = 1
      `, [user.masterbrandId || 1]);
    } else {
      rows = await db.query(`
        SELECT * FROM (
          SELECT *,
            ROW_NUMBER() OVER (
              PARTITION BY event_type
              ORDER BY 
                CASE 
                  WHEN merchant_id = ? THEN 0
                  WHEN masterbrand_id = ? THEN 1
                  ELSE 2
                END ASC
            ) as rank_val
          FROM tb_notification_templates
          WHERE merchant_id = ? OR (merchant_id IS NULL AND (masterbrand_id = ? OR masterbrand_id IS NULL))
        ) t WHERE rank_val = 1
      `, [user.merchantId, user.masterbrandId || 1, user.merchantId, user.masterbrandId || 1]);
    }

    res.json({ status: 1, data: rows });
  } catch (err) {
    next(err);
  }
}

async function createTemplate(req, res, next) {
  try {
    const { event_type, title_template, body_template } = req.body;
    const user = req.selloUser;
    
    const masterbrand_id = user.role.includes('MASTERBRAND') ? user.masterbrandId : null;
    const merchant_id = user.role.includes('MERCHANT') ? user.merchantId : null;

    await db.query(
      `INSERT INTO tb_notification_templates (masterbrand_id, merchant_id, event_type, title_template, body_template) VALUES (?, ?, ?, ?, ?)`,
      [masterbrand_id, merchant_id, event_type, title_template, body_template]
    );
    res.json({ status: 1, message: 'Template created' });
  } catch (err) {
    next(err);
  }
}

async function updateTemplate(req, res, next) {
  try {
    const { id } = req.params;
    const { title_template, body_template, is_active } = req.body;
    await db.query(
      `UPDATE tb_notification_templates SET title_template = ?, body_template = ?, is_active = ? WHERE id = ?`,
      [title_template, body_template, is_active, id]
    );
    res.json({ status: 1, message: 'Template updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHistory, getTemplates, createTemplate, updateTemplate };
