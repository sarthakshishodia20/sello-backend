const db = require('../../../database/mysqlLib');
const logger = require('../../../utilities/loggingUtil');

const MODULE = 'MerchantService';

/**
 * Merchant list powers the admin page with catalogue and order health indicators.
 */
async function getAllMerchants(masterbrandId, { search = '', status = 'all', limit = 10, offset = 0 } = {}) {
  await checkAndUpdateMerchantAvailability();
  const params = [masterbrandId];
  let whereSql = 'WHERE m.masterbrand_id = ?';

  if (status === 'active') {
    whereSql += ' AND m.is_active = 1';
  } else if (status === 'inactive') {
    whereSql += ' AND m.is_active = 0';
  }

  if (search) {
    whereSql += ' AND (m.id LIKE ? OR m.name LIKE ? OR m.slug LIKE ? OR m.phone LIKE ? OR owner.name LIKE ? OR owner.email LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }

  const countRows = await db.query(`
    SELECT COUNT(*) as total 
    FROM tb_merchants m
    LEFT JOIN tb_users owner ON owner.merchant_id = m.id AND owner.role = 'MERCHANT_ADMIN' AND owner.is_active = 1
    ${whereSql}
  `, params);
  const total = countRows[0].total;

  const dataParams = [...params, Number(limit), Number(offset)];
  const merchants = await db.query(`
    SELECT
      m.id AS merchant_id,
      m.name AS merchant_name,
      m.code,
      m.slug,
      m.description,
      m.contact_email,
      m.phone,
      m.address,
      m.theme_color,
      m.is_active,
      m.is_sponsored,
      m.settings,
      m.created_at,
      owner.id AS owner_user_id,
      owner.name AS owner_name,
      owner.email AS owner_email,
      COALESCE(cat.total_catalogue, 0) AS total_catalogue,
      COALESCE(cat.delinked_products, 0) AS delinked_products,
      COALESCE(ord.total_orders, 0) AS total_orders,
      COALESCE(ord.delivered_revenue, 0) AS delivered_revenue
    FROM tb_merchants m
    LEFT JOIN tb_users owner
      ON owner.merchant_id = m.id
     AND owner.role = 'MERCHANT_ADMIN'
     AND owner.is_active = 1
    LEFT JOIN (
      SELECT
        ac.merchant_id,
        COUNT(*) AS total_catalogue,
        SUM(CASE WHEN ac.source_type = 'MERCHANT' THEN 1 ELSE 0 END) AS delinked_products
      FROM tb_app_catalogue ac
      JOIN tb_products p ON p.id = ac.product_id AND p.is_deleted = 0
      GROUP BY ac.merchant_id
    ) cat ON cat.merchant_id = m.id
    LEFT JOIN (
      SELECT
        merchant_id,
        COUNT(*) AS total_orders,
        COALESCE(SUM(CASE WHEN order_status = 'DELIVERED' THEN total_amount ELSE 0 END), 0) AS delivered_revenue
      FROM tb_orders
      GROUP BY merchant_id
    ) ord ON ord.merchant_id = m.id
    ${whereSql}
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, Number(limit), Number(offset)]);

  return { merchants, total: total };
}

/**
 * Merchant detail is reused by profile pages and admin merchant drawer views.
 */
async function getMerchantById(merchantId, masterbrandId) {
  await checkAndUpdateMerchantAvailability();
  const rows = await db.query(`
    SELECT
      m.id AS merchant_id,
      m.masterbrand_id,
      m.name AS merchant_name,
      m.code,
      m.slug,
      m.description,
      m.contact_email,
      m.phone,
      m.address,
      m.theme_color,
      m.is_active,
      m.delivery_time,
      m.delivery_mode,
      m.city_name,
      m.settings,
      m.created_at,
      owner.id AS owner_user_id,
      owner.name AS owner_name,
      owner.email AS owner_email,
      owner.phone AS owner_phone
    FROM tb_merchants m
    LEFT JOIN tb_users owner
      ON owner.merchant_id = m.id
     AND owner.role = 'MERCHANT_ADMIN'
     AND owner.is_active = 1
    WHERE m.id = ? AND m.masterbrand_id = ?
    LIMIT 1
  `, [merchantId, masterbrandId]);

  return rows[0] || null;
}

/**
 * Merchant owners can update their store metadata without touching masterbrand catalogue data.
 */
async function updateMerchantProfile(merchantId, masterbrandId, fields) {
  const allowed = ['merchant_name', 'description', 'contact_email', 'phone', 'address', 'theme_color', 'delivery_time', 'delivery_mode', 'city_name', 'settings'];
  const updates = [];
  const params = [];

  allowed.forEach((key) => {
    if (fields[key] !== undefined) {
      const column = key === 'merchant_name' ? 'name' : key;
      updates.push(`${column} = ?`);
      let val = fields[key];
      if (key === 'settings' && typeof val === 'object' && val !== null) {
        val = JSON.stringify(val);
      }
      params.push(val !== undefined ? val : null);
    }
  });

  if (!updates.length) {
    return;
  }

  params.push(merchantId, masterbrandId);
  await db.query(
    `UPDATE tb_merchants SET ${updates.join(', ')} WHERE id = ? AND masterbrand_id = ?`,
    params
  );

  logger.info(MODULE, 'MERCHANT_PROFILE_UPDATED', { merchantId, masterbrandId });
}

/**
 * Admins can pause a merchant and its merchant-admin users together.
 */
async function toggleMerchantStatus(merchantId, masterbrandId, isActive) {
  await db.transaction(async (query) => {
    await query(
      'UPDATE tb_merchants SET is_active = ? WHERE id = ? AND masterbrand_id = ?',
      [Number(Boolean(isActive)), merchantId, masterbrandId]
    );

    await query(
      'UPDATE tb_users SET is_active = ? WHERE merchant_id = ?',
      [Number(Boolean(isActive)), merchantId]
    );
  });

  logger.info(MODULE, 'MERCHANT_STATUS_UPDATED', { merchantId, isActive });
}

async function toggleMerchantSponsored(merchantId, masterbrandId, isSponsored) {
  await db.query(
    'UPDATE tb_merchants SET is_sponsored = ? WHERE id = ? AND masterbrand_id = ?',
    [Number(Boolean(isSponsored)), merchantId, masterbrandId]
  );
  logger.info(MODULE, 'MERCHANT_SPONSORED_UPDATED', { merchantId, isSponsored });
}

/**
 * Overview data intentionally mixes counts, recent orders, and notifications for fast dashboard rendering.
 */
async function getOverview(user) {
  await checkAndUpdateMerchantAvailability();
  const notifications = await getNotifications(user, { limit: 5 });

  let stats = {};
  let recentOrders = [];

  if (user.role === 'MERCHANT_ADMIN') {
    const statsRows = await db.query(`
      SELECT
        COUNT(*) AS total_catalogue,
        SUM(CASE WHEN source_type = 'MERCHANT' THEN 1 ELSE 0 END) AS delinked_products,
        SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) AS live_catalogue
      FROM tb_app_catalogue
      WHERE merchant_id = ?
    `, [user.merchantId]);

    const orderRows = await db.query(`
      SELECT
        COUNT(*) AS total_orders,
        SUM(CASE WHEN order_status IN ('PLACED', 'CONFIRMED', 'PREPARING') THEN 1 ELSE 0 END) AS pending_orders,
        COALESCE(SUM(CASE WHEN order_status = 'DELIVERED' THEN total_amount ELSE 0 END), 0) AS delivered_revenue
      FROM tb_orders
      WHERE merchant_id = ?
    `, [user.merchantId]);

    recentOrders = await db.query(`
      SELECT
        id,
        order_no,
        customer_name,
        total_amount,
        order_status,
        created_at
      FROM tb_orders
      WHERE merchant_id = ?
      ORDER BY created_at DESC
      LIMIT 5
    `, [user.merchantId]);

    stats = {
      totalCatalogue: Number(statsRows[0]?.total_catalogue || 0),
      liveCatalogue: Number(statsRows[0]?.live_catalogue || 0),
      delinkedProducts: Number(statsRows[0]?.delinked_products || 0),
      totalOrders: Number(orderRows[0]?.total_orders || 0),
      pendingOrders: Number(orderRows[0]?.pending_orders || 0),
      deliveredRevenue: Number(orderRows[0]?.delivered_revenue || 0)
    };
  } else {
    const [merchantRows, categoryRows, productRows, orderRows, orders] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) AS total_merchants,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_merchants
        FROM tb_merchants
        WHERE masterbrand_id = ?
      `, [user.masterbrandId]),
      db.query('SELECT COUNT(*) AS total_categories FROM tb_categories WHERE masterbrand_id = ? AND is_deleted = 0', [user.masterbrandId]),
      db.query('SELECT COUNT(*) AS total_products FROM tb_products WHERE masterbrand_id = ? AND is_deleted = 0', [user.masterbrandId]),
      db.query(`
        SELECT
          COUNT(*) AS total_orders,
          SUM(CASE WHEN order_status IN ('PLACED', 'CONFIRMED', 'PREPARING') THEN 1 ELSE 0 END) AS pending_orders,
          COALESCE(SUM(CASE WHEN order_status = 'DELIVERED' THEN total_amount ELSE 0 END), 0) AS delivered_revenue
        FROM tb_orders
        WHERE masterbrand_id = ?
      `, [user.masterbrandId]),
      db.query(`
        SELECT
          o.id,
          o.order_no,
          o.customer_name,
          o.total_amount,
          o.order_status,
          o.created_at,
          m.name AS merchant_name
        FROM tb_orders o
        JOIN tb_merchants m ON m.id = o.merchant_id
        WHERE o.masterbrand_id = ?
        ORDER BY o.created_at DESC
        LIMIT 5
      `, [user.masterbrandId])
    ]);

    recentOrders = orders;
    stats = {
      totalMerchants: Number(merchantRows[0]?.total_merchants || 0),
      activeMerchants: Number(merchantRows[0]?.active_merchants || 0),
      totalCategories: Number(categoryRows[0]?.total_categories || 0),
      totalProducts: Number(productRows[0]?.total_products || 0),
      totalOrders: Number(orderRows[0]?.total_orders || 0),
      pendingOrders: Number(orderRows[0]?.pending_orders || 0),
      deliveredRevenue: Number(orderRows[0]?.delivered_revenue || 0)
    };
  }

  // Revenue Analytics (Last 7 Days)
  const analyticsRows = await db.query(`
    SELECT 
      DATE_FORMAT(created_at, '%Y-%m-%d') as date,
      COALESCE(SUM(CASE WHEN order_status = 'DELIVERED' THEN total_amount ELSE 0 END), 0) as revenue
    FROM tb_orders
    WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
      AND (masterbrand_id = ? OR merchant_id = ?)
    GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
    ORDER BY date ASC
  `, [user.masterbrandId, user.merchantId || 0]);

  const analytics = {
    labels: analyticsRows.map(r => r.date),
    data: analyticsRows.map(r => Number(r.revenue))
  };

  return {
    mode: user.role === 'MERCHANT_ADMIN' ? 'merchant' : 'admin',
    stats,
    recentOrders,
    notifications,
    analytics
  };
}

/**
 * Snoozed notifications are hidden until their snooze window expires.
 */
async function getNotifications(user, { limit = 10 } = {}) {
  if (user.role === 'MERCHANT_ADMIN') {
    return db.query(`
      SELECT id, title, message, type, is_read, snooze_until, created_at
      FROM tb_notifications
      WHERE (merchant_id = ? OR user_id = ?)
        AND (snooze_until IS NULL OR snooze_until <= NOW())
      ORDER BY created_at DESC
      LIMIT ?
    `, [user.merchantId, user.id, limit]);
  }

  return db.query(`
    SELECT id, title, message, type, is_read, snooze_until, created_at
    FROM tb_notifications
    WHERE (
      (merchant_id = ? OR user_id = ?)
      OR (user_id IS NULL AND merchant_id IS NULL AND masterbrand_id = ?)
    )
      AND (snooze_until IS NULL OR snooze_until <= NOW())
    ORDER BY created_at DESC
    LIMIT ?
  `, [user.merchantId || null, user.id, user.masterbrandId, limit]);
}

/**
 * Merchant users can quiet a feed item without deleting it from history.
 */
async function snoozeNotification(user, notificationId, snoozeUntil) {
  const result = await db.query(
    `UPDATE tb_notifications
     SET snooze_until = ?, is_read = 0
     WHERE id = ?
       AND (
         user_id = ?
         OR (? IS NOT NULL AND merchant_id = ?)
         OR (masterbrand_id = ? AND user_id IS NULL AND merchant_id IS NULL)
       )`,
    [
      snoozeUntil,
      notificationId,
      user.id,
      user.merchantId || null,
      user.merchantId || null,
      user.masterbrandId
    ]
  );

  return result.affectedRows > 0;
}

async function markNotificationRead(user, notificationId) {
  const result = await db.query(
    `UPDATE tb_notifications
     SET is_read = 1
     WHERE id = ?
       AND (
         user_id = ?
         OR (? IS NOT NULL AND merchant_id = ?)
         OR (masterbrand_id = ? AND user_id IS NULL AND merchant_id IS NULL)
       )`,
    [
      notificationId,
      user.id,
      user.merchantId || null,
      user.merchantId || null,
      user.masterbrandId
    ]
  );

  return result.affectedRows > 0;
}

async function createMerchant(masterbrandId, data) {
  const bcrypt = require('bcryptjs');
  const { toSlug, toCode } = require('../../../utilities/slugUtil');

  if (!data.password) {
    throw new Error('Password is required to create a merchant account.');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const baseSlug = toSlug(data.name) || 'sello-merchant';
  const uniqueSuffix = Date.now().toString(36);
  const slug = `${baseSlug}-${uniqueSuffix}`;
  const code = `${toCode(data.name) || 'MERCHANT'}_${uniqueSuffix.toUpperCase()}`.slice(0, 80);

  return db.transaction(async (query) => {
    const merchantResult = await query(
      `INSERT INTO tb_merchants (masterbrand_id, name, code, slug, contact_email, phone, address, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [masterbrandId, data.name, code, slug, data.email, data.phone || null, data.address || null]
    );

    const merchantId = merchantResult.insertId;

    await query(
      `INSERT INTO tb_users (masterbrand_id, merchant_id, name, email, password_hash, role, phone)
       VALUES (?, ?, ?, ?, ?, 'MERCHANT_ADMIN', ?)`,
      [masterbrandId, merchantId, data.name, data.email, passwordHash, data.phone || null]
    );

    // Seed inherited master catalogue
    await query(
      `INSERT INTO tb_app_catalogue (merchant_id, product_id, source_type, is_available)
       SELECT ?, p.id, 'MASTER', 1
       FROM tb_products p
       WHERE p.masterbrand_id = ? AND p.is_active = 1`,
      [merchantId, masterbrandId]
    );

    await query(
      `INSERT INTO tb_notifications (masterbrand_id, merchant_id, title, message, type)
       VALUES (?, ?, 'Welcome to Sello', 'Your merchant dashboard is ready. Review inherited products and start accepting orders.', 'SUCCESS')`,
      [masterbrandId, merchantId]
    );

    logger.info(MODULE, 'MERCHANT_CREATED', { merchantId, slug });
    return { id: merchantId, slug };
  });
}

async function deleteMerchant(merchantId, masterbrandId) {
  return db.transaction(async (query) => {
    // Delete associated data first
    await query('DELETE FROM tb_notifications WHERE merchant_id = ?', [merchantId]);
    await query('DELETE FROM tb_app_catalogue WHERE merchant_id = ?', [merchantId]);
    await query('DELETE FROM tb_users WHERE merchant_id = ?', [merchantId]);
    
    // Finally delete the merchant
    const result = await query(
      'DELETE FROM tb_merchants WHERE id = ? AND masterbrand_id = ?',
      [merchantId, masterbrandId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Merchant not found or unauthorized');
    }

    logger.info(MODULE, 'MERCHANT_DELETED', { merchantId });
    return true;
  });
}

async function getMasterbrandSettings(masterbrandId) {
  const rows = await db.query('SELECT settings FROM tb_masterbrand WHERE id = ?', [masterbrandId]);
  return rows[0]?.settings || {};
}

async function updateMasterbrandSettings(masterbrandId, settings) {
  await db.query('UPDATE tb_masterbrand SET settings = ? WHERE id = ?', [JSON.stringify(settings), masterbrandId]);
  logger.info(MODULE, 'MASTERBRAND_SETTINGS_UPDATED', { masterbrandId });
}

async function checkAndUpdateMerchantAvailability() {
  try {
    const masterbrands = await db.query('SELECT id, settings FROM tb_masterbrand');
    for (const mb of masterbrands) {
      let mbSettings = {};
      try {
        mbSettings = typeof mb.settings === 'string' ? JSON.parse(mb.settings) : (mb.settings || {});
      } catch (e) {}

      if (!mbSettings.availabilityEnabled) {
        continue;
      }

      const merchants = await db.query(
        'SELECT id, settings, is_active FROM tb_merchants WHERE masterbrand_id = ?',
        [mb.id]
      );

      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const now = new Date();
      const currentDay = daysOfWeek[now.getDay()];
      const currentHHMM = now.toTimeString().slice(0, 5);

      for (const m of merchants) {
        let mSettings = {};
        try {
          mSettings = typeof m.settings === 'string' ? JSON.parse(m.settings) : (m.settings || {});
        } catch (e) {}

        const avail = mSettings.availability;
        if (avail && avail.enabled) {
          const dayConfig = avail.days?.[currentDay];
          let targetActiveState = 1;

          if (!dayConfig || !dayConfig.enabled) {
            targetActiveState = 0;
          } else {
            if (dayConfig.openAllDay) {
              targetActiveState = 1;
            } else {
              const start = dayConfig.start || '00:00';
              const end = dayConfig.end || '23:59';
              if (currentHHMM >= start && currentHHMM <= end) {
                targetActiveState = 1;
              } else {
                targetActiveState = 0;
              }
            }
          }

          if (m.is_active !== targetActiveState) {
            await db.query('UPDATE tb_merchants SET is_active = ? WHERE id = ?', [targetActiveState, m.id]);
            await db.query('UPDATE tb_users SET is_active = ? WHERE merchant_id = ?', [targetActiveState, m.id]);
            logger.info(MODULE, 'AUTO_MERCHANT_AVAILABILITY_STATE_UPDATED', {
              merchantId: m.id,
              isActive: targetActiveState,
              day: currentDay,
              time: currentHHMM
            });
          }
        }
      }
    }
  } catch (err) {
    logger.error(MODULE, 'AUTO_AVAILABILITY_SCHEDULER_ERROR', { error: err.message });
  }
}

module.exports = {
  getAllMerchants,
  getMerchantById,
  updateMerchantProfile,
  toggleMerchantStatus,
  toggleMerchantSponsored,
  createMerchant,
  getOverview,
  getNotifications,
  snoozeNotification,
  markNotificationRead,
  deleteMerchant,
  getMasterbrandSettings,
  updateMasterbrandSettings,
  checkAndUpdateMerchantAvailability
};
