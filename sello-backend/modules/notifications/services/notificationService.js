/**
 * Sello — Notification Service
 *
 * Owns all direct DB access for notification templates and received history.
 * The controller stays thin and delegates everything here.
 */

const db = require('../../../database/mysqlLib');

// ─── History ──────────────────────────────────────────────────────────────────

/**
 * Fetch paginated notification history scoped to the requesting user.
 * Admins see their own + platform-wide entries; merchants see merchant-scoped entries.
 *
 * @param {Object} user - req.selloUser
 * @param {{ page: number, limit: number }} pagination
 * @returns {{ rows: Object[], total: number }}
 */
async function getHistory(user, { page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;

  let condition;
  let params;
  let countParams;

  if (user.role === 'MASTERBRAND_ADMIN' || user.role === 'SUPER_ADMIN') {
    condition   = `(user_id = ? OR (user_id IS NULL AND merchant_id IS NULL))`;
    params      = [user.id, parseInt(limit), parseInt(offset)];
    countParams = [user.id];
  } else {
    condition   = `merchant_id = ?`;
    params      = [user.merchantId, parseInt(limit), parseInt(offset)];
    countParams = [user.merchantId];
  }

  const rows      = await db.query(
    `SELECT * FROM tb_notification_received WHERE ${condition} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    params
  );
  const totalRows = await db.query(
    `SELECT COUNT(*) as count FROM tb_notification_received WHERE ${condition}`,
    countParams
  );

  return { rows, total: totalRows[0].count };
}

// ─── Templates ────────────────────────────────────────────────────────────────

/**
 * Fetch the effective template per event_type for the requesting user.
 * Merchant-specific templates take priority over masterbrand defaults.
 *
 * @param {Object} user - req.selloUser
 * @returns {Object[]}
 */
async function getTemplates(user) {
  if (user.role === 'MASTERBRAND_ADMIN' || user.role === 'SUPER_ADMIN') {
    return db.query(
      `SELECT * FROM (
         SELECT *,
           ROW_NUMBER() OVER (
             PARTITION BY event_type
             ORDER BY masterbrand_id DESC
           ) as rank_val
         FROM tb_notification_templates
         WHERE masterbrand_id = ? OR (masterbrand_id IS NULL AND merchant_id IS NULL)
       ) t WHERE rank_val = 1`,
      [user.masterbrandId || 1]
    );
  }

  return db.query(
    `SELECT * FROM (
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
     ) t WHERE rank_val = 1`,
    [user.merchantId, user.masterbrandId || 1, user.merchantId, user.masterbrandId || 1]
  );
}

/**
 * Insert a new notification template scoped to the requesting user's level.
 *
 * @param {Object} user - req.selloUser
 * @param {{ event_type: string, title_template: string, body_template: string }} data
 */
async function createTemplate(user, { event_type, title_template, body_template }) {
  const masterbrand_id = user.role.includes('MASTERBRAND') ? user.masterbrandId : null;
  const merchant_id    = user.role.includes('MERCHANT')    ? user.merchantId    : null;

  await db.query(
    `INSERT INTO tb_notification_templates (masterbrand_id, merchant_id, event_type, title_template, body_template)
     VALUES (?, ?, ?, ?, ?)`,
    [masterbrand_id, merchant_id, event_type, title_template, body_template]
  );
}

/**
 * Update an existing template by ID.
 *
 * @param {number} id
 * @param {{ title_template: string, body_template: string, is_active: boolean }} data
 */
async function updateTemplate(id, { title_template, body_template, is_active }) {
  await db.query(
    `UPDATE tb_notification_templates SET title_template = ?, body_template = ?, is_active = ? WHERE id = ?`,
    [title_template, body_template, is_active, id]
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getHistory,
  getTemplates,
  createTemplate,
  updateTemplate
};
