const db = require('../../../database/mysqlLib');
const logger = require('../../../utilities/loggingUtil');

const MODULE = 'OrderService';

/**
 * Human-readable order id for the dashboard and webapp confirmation screen.
 */
function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `SEL-${ts}-${rand}`;
}

/**
 * Public checkout resolves effective product data from tb_app_catalogue
 * so the server always decides the final order price and product snapshot.
 */
async function placeOrder({
  merchant_id,
  customer_name,
  customer_phone,
  customer_email,
  customer_address,
  customer_id,
  items,
  notes
}) {
  const merchantRows = await db.query(
    `SELECT id, masterbrand_id, name
     FROM tb_merchants
     WHERE id = ? AND is_active = 1
     LIMIT 1`,
    [merchant_id]
  );

  const merchant = merchantRows[0];
  if (!merchant) {
    throw new Error('Merchant not found');
  }

  // Fetch Masterbrand Settings to check COD availability
  const mbRows = await db.query('SELECT settings FROM tb_masterbrand WHERE id = ?', [merchant.masterbrand_id]);
  const mbSettings = mbRows[0]?.settings || {};

  if (mbSettings.codEnabled === false) {
    throw new Error('Cash on Delivery (COD) is currently disabled by the platform.');
  }

  const catalogueIds = items.map((item) => item.catalogue_id);
  const placeholders = catalogueIds.map(() => '?').join(', ');
  const catalogueRows = await db.query(`
    SELECT
      ac.id AS catalogue_id,
      ac.merchant_id,
      ac.product_id AS source_product_id,
      ac.override_product_id AS merchant_product_id,
      ac.is_available,
      COALESCE(mp.name, p.name) AS product_name,
      COALESCE(mp.sku, p.sku) AS sku,
      COALESCE(mp.price, p.price) AS unit_price,
      COALESCE(mp.is_active, p.is_active) AS product_is_active,
      COALESCE(mp.stock_qty, p.stock_qty) AS stock_qty
    FROM tb_app_catalogue ac
    JOIN tb_products p ON p.id = ac.product_id
    LEFT JOIN tb_merchant_products mp ON mp.id = ac.override_product_id
    WHERE ac.merchant_id = ?
      AND ac.id IN (${placeholders})
  `, [merchant_id, ...catalogueIds]);

  const catalogueMap = new Map(catalogueRows.map((row) => [row.catalogue_id, row]));

  const normalizedItems = items.map((item) => {
    const resolved = catalogueMap.get(item.catalogue_id);
    if (!resolved) {
      throw new Error(`Product with ID ${item.catalogue_id} not found in this store's catalogue`);
    }

    if (!resolved.is_available || !resolved.product_is_active) {
      throw new Error(`"${resolved.product_name}" is currently out of stock or unavailable`);
    }

    // Stock check: -1 or null means unlimited, otherwise enforce quantity
    const stockQty = resolved.stock_qty;
    const hasInventory = stockQty !== null && stockQty !== -1;
    if (hasInventory && stockQty < item.quantity) {
      throw new Error(`Insufficient stock for "${resolved.product_name}" (available: ${stockQty})`);
    }


    return {
      catalogue_id: item.catalogue_id,
      quantity: item.quantity,
      source_product_id: resolved.source_product_id,
      merchant_product_id: resolved.merchant_product_id,
      product_name: resolved.product_name,
      sku: resolved.sku,
      unit_price: Number(resolved.unit_price),
      line_total: Number(resolved.unit_price) * item.quantity,
      hasInventory,
      merchant_product_id_for_stock: resolved.merchant_product_id,
      source_product_id_for_stock: resolved.source_product_id
    };
  });


  const subtotal = normalizedItems.reduce((sum, item) => sum + item.line_total, 0);
  const orderNo = generateOrderNumber();

  return db.transaction(async (query) => {
    const orderResult = await query(
      `INSERT INTO tb_orders
        (order_no, masterbrand_id, merchant_id, placed_by_user_id, customer_name, customer_phone, customer_email, customer_address, payment_method, payment_status, order_status, subtotal, total_amount, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COD', 'PENDING', 'PLACED', ?, ?, ?)`,
      [
        orderNo,
        merchant.masterbrand_id,
        merchant.id,
        customer_id || null,
        customer_name,
        customer_phone,
        customer_email || null,
        customer_address,
        subtotal,
        subtotal,
        notes || null
      ]
    );

    for (const item of normalizedItems) {
      await query(
        `INSERT INTO tb_order_items
          (order_id, source_product_id, merchant_product_id, product_name_snapshot, sku_snapshot, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderResult.insertId,
          item.source_product_id,
          item.merchant_product_id || null,
          item.product_name,
          item.sku,
          item.quantity,
          item.unit_price,
          item.line_total
        ]
      );

      // Decrement stock if inventory is enabled
      if (item.hasInventory) {
        if (item.merchant_product_id_for_stock) {
          await query(
            'UPDATE tb_merchant_products SET stock_qty = stock_qty - ? WHERE id = ?',
            [item.quantity, item.merchant_product_id_for_stock]
          );
        } else {
          await query(
            'UPDATE tb_products SET stock_qty = stock_qty - ? WHERE id = ?',
            [item.quantity, item.source_product_id_for_stock]
          );
        }
      }
    }

    await query(
      `INSERT INTO tb_notifications (masterbrand_id, merchant_id, title, message, type)
       VALUES (?, ?, 'New COD order', ?, 'INFO')`,
      [merchant.masterbrand_id, merchant.id, `Order ${orderNo} has been placed by ${customer_name}.`]
    );

    logger.info(MODULE, 'ORDER_PLACED', {
      orderId: orderResult.insertId,
      orderNo,
      merchantId: merchant.id,
      subtotal
    });

    return {
      order_id: orderResult.insertId,
      order_no: orderNo,
      total_amount: subtotal,
      merchant_name: merchant.name
    };
  });
}

/**
 * Scope builder allows admin-level all-merchant reporting without losing merchant isolation.
 */
function buildOrderWhere(user, { merchantId, status, search, date }) {
  const params = [];
  let whereSql = '';

  if (user.role === 'MERCHANT_ADMIN') {
    whereSql = 'WHERE o.merchant_id = ?';
    params.push(user.merchantId);
  } else {
    whereSql = 'WHERE o.masterbrand_id = ?';
    params.push(user.masterbrandId);

    if (merchantId) {
      whereSql += ' AND o.merchant_id = ?';
      params.push(merchantId);
    }
  }

  if (status) {
    whereSql += ' AND o.order_status = ?';
    params.push(status);
  }

  if (search) {
    whereSql += ' AND o.order_no LIKE ?';
    params.push(`%${search}%`);
  }

  if (date) {
    whereSql += ' AND DATE(o.created_at) = ?';
    params.push(date);
  }

  return { whereSql, params };
}

/**
 * Paginated order list for the dashboard orders page.
 */
async function getOrders(user, { merchantId = null, status = '', search = '', date = '', page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const { whereSql, params } = buildOrderWhere(user, { merchantId, status, search, date });

  const countRows = await db.query(
    `SELECT COUNT(*) AS total FROM tb_orders o ${whereSql}`,
    params
  );

  const orders = await db.query(`
    SELECT
      o.id,
      o.order_no,
      o.customer_name,
      o.customer_phone,
      o.customer_email,
      o.customer_address,
      o.payment_method,
      o.payment_status,
      o.order_status,
      o.subtotal,
      o.total_amount,
      o.notes,
      o.created_at,
      m.name AS merchant_name
    FROM tb_orders o
    JOIN tb_merchants m ON m.id = o.merchant_id
    ${whereSql}
    ORDER BY o.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  return {
    orders,
    total: Number(countRows[0]?.total || 0),
    page,
    limit
  };
}

/**
 * Order detail page pulls item snapshots in a second query.
 */
async function getOrderById(orderId, user) {
  const { whereSql, params } = buildOrderWhere(user, {});
  const rows = await db.query(`
    SELECT
      o.*,
      m.name AS merchant_name
    FROM tb_orders o
    JOIN tb_merchants m ON m.id = o.merchant_id
    ${whereSql} AND o.id = ?
    LIMIT 1
  `, [...params, orderId]);

  const order = rows[0];
  if (!order) {
    return null;
  }

  order.items = await db.query(
    `SELECT
       id,
       source_product_id,
       merchant_product_id,
       product_name_snapshot,
       sku_snapshot,
       quantity,
       unit_price,
       line_total
     FROM tb_order_items
     WHERE order_id = ?
     ORDER BY id ASC`,
    [orderId]
  );

  return order;
}

/**
 * Merchant or admin updates the order lifecycle.
 */
async function updateOrderStatus(orderId, user, status) {
  const { whereSql, params } = buildOrderWhere(user, {});
  
  let querySql = `UPDATE tb_orders o SET o.order_status = ? ${whereSql} AND o.id = ?`;
  
  // If status is 'DELIVERED', automatically collect the payment!
  if (status === 'DELIVERED') {
    querySql = `UPDATE tb_orders o SET o.order_status = ?, o.payment_status = 'COLLECTED' ${whereSql} AND o.id = ?`;
  }

  const result = await db.query(querySql, [status, ...params, orderId]);

  logger.info(MODULE, 'ORDER_STATUS_UPDATED', { orderId, status, actor: user.id });
  return result.affectedRows > 0;
}

/**
 * Revenue and order summary for the dashboard cards and orders page.
 */
async function getOrderStats(user, merchantId = null) {
  const { whereSql, params } = buildOrderWhere(user, { merchantId });
  const rows = await db.query(`
    SELECT
      COUNT(*) AS total_orders,
      SUM(CASE WHEN o.order_status IN ('PLACED', 'CONFIRMED', 'PREPARING') THEN 1 ELSE 0 END) AS pending_orders,
      SUM(CASE WHEN o.order_status = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered_orders,
      COALESCE(SUM(CASE WHEN o.order_status = 'DELIVERED' THEN o.total_amount ELSE 0 END), 0) AS total_revenue
    FROM tb_orders o
    ${whereSql}
  `, params);

  return rows[0] || {
    total_orders: 0,
    pending_orders: 0,
    delivered_orders: 0,
    total_revenue: 0
  };
}

/**
 * Analytics for the new Analytics Dashboard
 */
async function getOrderAnalytics(user, timeframe = 'monthly') {
  // Determine date filter
  let dateFilter = '';
  const now = new Date();
  if (timeframe === 'weekly') {
    dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
  } else if (timeframe === 'monthly') {
    dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
  } else if (timeframe === 'yearly') {
    dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
  }

  // 1. Order and Sales Metrics
  const { whereSql: orderWhere, params: orderParams } = buildOrderWhere(user, {});
  const orderStatsRows = await db.query(`
    SELECT
      COALESCE(SUM(CASE WHEN o.order_status = 'DELIVERED' THEN o.total_amount ELSE 0 END), 0) AS total_sales,
      COUNT(DISTINCT o.customer_phone) AS unique_customers,
      SUM(CASE WHEN o.order_status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_orders,
      SUM(CASE WHEN o.order_status IN ('PLACED', 'CONFIRMED', 'PREPARING') THEN 1 ELSE 0 END) AS pending_orders,
      SUM(CASE WHEN o.order_status = 'OUT_FOR_DELIVERY' THEN 1 ELSE 0 END) AS dispatched_orders,
      SUM(CASE WHEN o.order_status = 'DELIVERED' THEN 1 ELSE 0 END) AS completed_orders
    FROM tb_orders o
    ${orderWhere} ${dateFilter}
  `, orderParams);

  // 2. Merchant Metrics
  // Admin sees all merchants in masterbrand. Merchant admin sees only themselves.
  let merchantWhere = 'WHERE masterbrand_id = ?';
  const merchantParams = [user.masterbrandId];
  if (user.role === 'MERCHANT_ADMIN') {
    merchantWhere += ' AND id = ?';
    merchantParams.push(user.merchantId);
  }

  const merchantStatsRows = await db.query(`
    SELECT
      COUNT(*) AS total_merchants,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_merchants,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_merchants,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS open_merchants,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS closed_merchants
    FROM tb_merchants
    ${merchantWhere}
  `, merchantParams);

  // 3. Time-series data for Charts
  let groupingSql = '';
  if (timeframe === 'weekly' || timeframe === 'monthly') {
    groupingSql = "DATE_FORMAT(o.created_at, '%Y-%m-%d')";
  } else {
    groupingSql = "DATE_FORMAT(o.created_at, '%Y-%m')";
  }

  const chartRows = await db.query(`
    SELECT 
      ${groupingSql} AS label,
      COALESCE(SUM(o.total_amount), 0) AS value
    FROM tb_orders o
    ${orderWhere} ${dateFilter}
    GROUP BY ${groupingSql}
    ORDER BY label ASC
  `, orderParams);

  const orderStats = orderStatsRows[0] || {};
  const merchantStats = merchantStatsRows[0] || {};

  return {
    sales: orderStats.total_sales || 0,
    customers: orderStats.unique_customers || 0,
    merchants_total: merchantStats.total_merchants || 0,
    orders: {
      cancelled: orderStats.cancelled_orders || 0,
      pending: orderStats.pending_orders || 0,
      dispatched: orderStats.dispatched_orders || 0,
      completed: orderStats.completed_orders || 0
    },
    merchants: {
      active: merchantStats.active_merchants || 0,
      inactive: merchantStats.inactive_merchants || 0,
      open: merchantStats.open_merchants || 0,
      closed: merchantStats.closed_merchants || 0
    },
    chart: chartRows || []
  };
}

/**
 * Bulk delete orders.
 */
async function deleteOrders(ids, user) {
  if (!ids || !ids.length) return 0;
  const placeholders = ids.map(() => '?').join(', ');
  let sql = '';
  let params = [...ids];

  if (user.role === 'SUPER_ADMIN') {
    sql = `DELETE FROM tb_orders WHERE id IN (${placeholders})`;
  } else if (user.role === 'MASTERBRAND_ADMIN') {
    sql = `DELETE FROM tb_orders WHERE id IN (${placeholders}) AND masterbrand_id = ?`;
    params.push(user.masterbrandId);
  } else if (user.role === 'MERCHANT_ADMIN') {
    sql = `DELETE FROM tb_orders WHERE id IN (${placeholders}) AND merchant_id = ?`;
    params.push(user.merchantId);
  } else {
    return 0;
  }

  const result = await db.query(sql, params);
  return result.affectedRows;
}

/**
 * Customers fetch their own orders.
 */
async function getCustomerOrders(userId) {
  const orders = await db.query(`
    SELECT 
      o.id,
      o.order_no,
      o.customer_name,
      o.order_status,
      o.total_amount,
      o.created_at,
      m.name AS merchant_name,
      m.slug AS merchant_slug
    FROM tb_orders o
    JOIN tb_merchants m ON m.id = o.merchant_id
    WHERE o.placed_by_user_id = ?
    ORDER BY o.created_at DESC
  `, [userId]);

  // Fetch items for each order
  for (const order of orders) {
    order.items = await db.query(`
      SELECT product_name_snapshot, quantity, unit_price 
      FROM tb_order_items 
      WHERE order_id = ?
    `, [order.id]);
  }

  return orders;
}

/**
 * Customers can cancel their own orders if they are still PLACED or CONFIRMED.
 */
async function cancelOrder(orderId, userId) {
  const result = await db.query(
    `UPDATE tb_orders 
     SET order_status = 'CANCELLED' 
     WHERE id = ? AND placed_by_user_id = ? AND order_status IN ('PLACED', 'CONFIRMED')`,
    [orderId, userId]
  );
  return result.affectedRows > 0;
}

async function getBillBreakdown({ merchant_id, items }) {
  const merchantRows = await db.query(
    `SELECT id, masterbrand_id, name
     FROM tb_merchants
     WHERE id = ? AND is_active = 1
     LIMIT 1`,
    [merchant_id]
  );

  const merchant = merchantRows[0];
  if (!merchant) {
    throw new Error('Merchant not found');
  }

  // Fetch Masterbrand Settings to check COD availability
  const mbRows = await db.query('SELECT settings FROM tb_masterbrand WHERE id = ?', [merchant.masterbrand_id]);
  const mbSettings = mbRows[0]?.settings || {};

  if (mbSettings.codEnabled === false) {
    throw new Error('Cash on Delivery (COD) is currently disabled by the platform.');
  }

  if (!items || !items.length) {

    throw new Error('No items provided');
  }

  const catalogueIds = items.map((item) => item.catalogue_id);
  const placeholders = catalogueIds.map(() => '?').join(', ');
  const catalogueRows = await db.query(`
    SELECT
      ac.id AS catalogue_id,
      ac.is_available,
      COALESCE(mp.name, p.name) AS product_name,
      COALESCE(mp.price, p.price) AS unit_price,
      COALESCE(mp.is_active, p.is_active) AS product_is_active,
      COALESCE(mp.stock_qty, p.stock_qty) AS stock_qty
    FROM tb_app_catalogue ac
    JOIN tb_products p ON p.id = ac.product_id
    LEFT JOIN tb_merchant_products mp ON mp.id = ac.override_product_id
    WHERE ac.merchant_id = ?
      AND ac.id IN (${placeholders})
  `, [merchant_id, ...catalogueIds]);

  const catalogueMap = new Map(catalogueRows.map((row) => [row.catalogue_id, row]));

  const validatedItems = items.map((item) => {
    const resolved = catalogueMap.get(item.catalogue_id);
    if (!resolved) {
      throw new Error(`Item ${item.catalogue_id} not found in merchant catalogue`);
    }

    if (!resolved.is_available || !resolved.product_is_active) {
      throw new Error(`"${resolved.product_name}" is currently unavailable`);
    }

    const stockQty = resolved.stock_qty;
    const hasInventory = stockQty !== null && stockQty !== -1;
    if (hasInventory && stockQty < item.quantity) {
      throw new Error(`Insufficient stock for "${resolved.product_name}" (available: ${stockQty})`);
    }

    return {
      catalogue_id: item.catalogue_id,
      product_name: resolved.product_name,
      unit_price: Number(resolved.unit_price),
      quantity: item.quantity,
      line_total: Number(resolved.unit_price) * item.quantity
    };
  });

  const subtotal = validatedItems.reduce((sum, item) => sum + item.line_total, 0);

  return {
    merchant_id,
    merchant_name: merchant.name,
    items: validatedItems,
    subtotal,
    delivery_fee: 0, // Phase 1: Free delivery
    total_amount: subtotal
  };
}

module.exports = {
  placeOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrderStats,
  getOrderAnalytics,
  deleteOrders,
  getCustomerOrders,
  cancelOrder,
  getBillBreakdown
};

