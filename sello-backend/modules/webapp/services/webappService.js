const db = require('../../../database/mysqlLib');
const { buildCategoryTree } = require('../../catalog/services/catalogService');

/**
 * Public store discovery page with lightweight merchant stats.
 */
async function getAllActiveStores(search = '', city = '', mode = 'ALL', limit = 12, offset = 0) {
  const { checkAndUpdateMerchantAvailability } = require('../../merchants/services/merchantService');
  await checkAndUpdateMerchantAvailability();

  const params = [];
  let whereSql = 'WHERE 1=1'; 
  
  if (search) {
    const like = `%${search}%`;
    whereSql += ` AND (
      m.name LIKE ? 
      OR m.city_name LIKE ?
      OR m.id IN (
        SELECT ac.merchant_id 
        FROM tb_app_catalogue ac 
        JOIN tb_products p ON p.id = ac.product_id 
        LEFT JOIN tb_merchant_products mp ON mp.id = ac.override_product_id
        WHERE (p.name LIKE ? OR mp.name LIKE ?)
      )
    )`;
    params.push(like, like, like, like);
  }

  if (city) {
    whereSql += ' AND m.city_name = ?';
    params.push(city);
  }

  if (mode !== 'ALL') {
    whereSql += ' AND (m.delivery_mode = ? OR m.delivery_mode = "BOTH")';
    params.push(mode);
  }

  params.push(Number(limit), Number(offset));

  return db.query(`
    SELECT
      m.id,
      m.name AS store_name,
      m.slug AS store_slug,
      m.description,
      m.contact_email,
      m.phone,
      m.address,
      m.image_url,
      m.theme_color,
      m.is_active,
      m.is_sponsored,
      m.delivery_time,
      m.delivery_mode,
      m.city_name,
      m.created_at,
      COALESCE(cat.total_products, 0) AS total_products
    FROM tb_merchants m
    LEFT JOIN (
      SELECT merchant_id, COUNT(*) AS total_products
      FROM tb_app_catalogue
      WHERE is_available = 1
      GROUP BY merchant_id
    ) cat ON cat.merchant_id = m.id
    ${whereSql}
    ORDER BY m.is_sponsored DESC, COALESCE(cat.total_products, 0) DESC, m.name ASC
    LIMIT ? OFFSET ?
  `, params);
}

/**
 * Store hero data used by the webapp storefront page.
 */
async function getStoreBySlug(slug) {
  const { checkAndUpdateMerchantAvailability } = require('../../merchants/services/merchantService');
  await checkAndUpdateMerchantAvailability();

  const rows = await db.query(`
    SELECT
      m.id,
      m.masterbrand_id,
      mb.name AS masterbrand_name,
      mb.code AS masterbrand_code,
      m.name AS store_name,
      m.slug AS store_slug,
      m.description,
      m.contact_email,
      m.phone,
      m.address,
      m.image_url,
      m.is_active,
      m.delivery_time,
      m.delivery_mode,
      m.city_name,
      m.theme_color,
      m.settings
    FROM tb_merchants m
    INNER JOIN tb_masterbrand mb ON m.masterbrand_id = mb.id
    WHERE m.slug = ? AND m.is_active = 1
    LIMIT 1
  `, [slug]);

  return rows[0] || null;
}

/**
 * Category filters for a store come from the masterbrand tree, but only categories that matter can be shown.
 */
async function getCategoriesForStore(masterbrandId) {
  const categories = await db.query(`
    SELECT
      id,
      masterbrand_id,
      parent_id,
      name,
      slug,
      description,
      sort_order,
      is_active,
      created_at
    FROM tb_categories
    WHERE masterbrand_id = ? AND is_active = 1
    ORDER BY sort_order ASC, created_at ASC
  `, [masterbrandId]);

  return {
    categories,
    tree: buildCategoryTree(categories)
  };
}

/**
 * Effective public product list resolves master rows and delinked merchant overrides the same way checkout does.
 */
async function getProductsForStore(merchantId, { categoryId = null, search = '', limit = 10, offset = 0 } = {}) {
  const params = [merchantId];
  let whereSql = `
    WHERE ac.merchant_id = ?
      AND ac.is_available = 1
      AND COALESCE(mp.is_active, p.is_active) = 1
  `;

  if (categoryId) {
    whereSql += ' AND COALESCE(mp.category_id, p.category_id) = ?';
    params.push(categoryId);
  }
  if (search) {
    whereSql += ' AND COALESCE(mp.name, p.name) LIKE ?';
    params.push(`%${search}%`);
  }

  // Count total for pagination
  const countRows = await db.query(`
    SELECT COUNT(*) AS total
    FROM tb_app_catalogue ac
    JOIN tb_products p ON p.id = ac.product_id
    LEFT JOIN tb_merchant_products mp ON mp.id = ac.override_product_id
    ${whereSql}
  `, params);

  const total = countRows[0].total;

  // Fetch paginated results
  params.push(Number(limit), Number(offset));
  const products = await db.query(`
    SELECT
      ac.id AS catalogue_id,
      ac.product_id AS source_product_id,
      ac.override_product_id AS merchant_product_id,
      ac.source_type,
      COALESCE(mp.category_id, p.category_id) AS category_id,
      c.name AS category_name,
      COALESCE(mp.sku, p.sku) AS sku,
      COALESCE(mp.name, p.name) AS name,
      COALESCE(mp.short_description, p.short_description) AS short_description,
      COALESCE(mp.description, p.description) AS description,
      COALESCE(mp.ai_description, p.ai_description) AS ai_description,
      COALESCE(mp.price, p.price) AS price,
      COALESCE(mp.stock_qty, p.stock_qty) AS stock_qty,
      COALESCE(mp.image_url, p.image_url) AS image_url,
      ac.is_out_of_stock,
      ac.snooze_until,
      COALESCE(ac.discount_percent, 0) AS discount_percent,
      COALESCE(ac.gst_percent, 0) AS gst_percent,
      COALESCE(ac.delivery_charge, 0) AS delivery_charge,
      ROUND(
        (COALESCE(mp.price, p.price) * (1 - COALESCE(ac.discount_percent, 0) / 100) * (1 + COALESCE(ac.gst_percent, 0) / 100))
        + COALESCE(ac.delivery_charge, 0)
      , 2) AS final_price
    FROM tb_app_catalogue ac
    JOIN tb_products p ON p.id = ac.product_id
    LEFT JOIN tb_merchant_products mp ON mp.id = ac.override_product_id
    LEFT JOIN tb_categories c ON c.id = COALESCE(mp.category_id, p.category_id)
    ${whereSql}
    ORDER BY p.sort_order ASC, ac.id ASC
    LIMIT ? OFFSET ?
  `, params);

  return { products, total };
}

async function getWishlistItems(storeIds, productIds) {
  let stores = [];
  let products = [];

  if (storeIds && storeIds.length > 0) {
    stores = await db.query(`
      SELECT m.id, m.name as store_name, m.slug as store_slug, m.description, m.image_url, m.theme_color, m.is_active, m.city_name
      FROM tb_merchants m
      WHERE m.id IN (?) AND m.is_active = 1
    `, [storeIds]);
  }

  if (productIds && productIds.length > 0) {
    products = await db.query(`
      SELECT
        ac.id AS catalogue_id,
        ac.product_id AS source_product_id,
        ac.override_product_id AS merchant_product_id,
        ac.merchant_id,
        m.name as store_name,
        m.slug as store_slug,
        COALESCE(mp.name, p.name) AS name,
        COALESCE(mp.price, p.price) AS price,
        COALESCE(mp.image_url, p.image_url) AS image_url,
        ac.is_out_of_stock
      FROM tb_app_catalogue ac
      JOIN tb_products p ON p.id = ac.product_id
      JOIN tb_merchants m ON m.id = ac.merchant_id
      LEFT JOIN tb_merchant_products mp ON mp.id = ac.override_product_id
      WHERE ac.id IN (?) AND ac.is_available = 1
    `, [productIds]);
  }

  return { stores, products };
}

async function getMasterbrandSettings(masterbrandId = 1) {
  const queryId = masterbrandId || 1;
  const rows = await db.query('SELECT settings FROM tb_masterbrand WHERE id = ?', [queryId]);
  return rows[0]?.settings || {};
}

async function toggleWishlist(customerId, type, itemId) {
  const existing = await db.query(
    'SELECT id FROM tb_customer_wishlist WHERE customer_id = ? AND type = ? AND item_id = ?',
    [customerId, type, itemId]
  );

  if (existing.length > 0) {
    await db.query('DELETE FROM tb_customer_wishlist WHERE id = ?', [existing[0].id]);
    return { added: false };
  } else {
    await db.query(
      'INSERT INTO tb_customer_wishlist (customer_id, type, item_id) VALUES (?, ?, ?)',
      [customerId, type, itemId]
    );
    return { added: true };
  }
}

async function getCustomerWishlist(customerId) {
  const items = await db.query(
    'SELECT type, item_id FROM tb_customer_wishlist WHERE customer_id = ?',
    [customerId]
  );

  const storeIds = items.filter(i => i.type === 'STORE').map(i => i.item_id);
  const productIds = items.filter(i => i.type === 'PRODUCT').map(i => i.item_id);

  return getWishlistItems(storeIds, productIds);
}

async function getTopSellingProductsForStore(merchantId) {
  const params = [merchantId];
  const products = await db.query(`
    SELECT
      ac.id AS catalogue_id,
      ac.product_id AS source_product_id,
      ac.override_product_id AS merchant_product_id,
      ac.source_type,
      COALESCE(mp.category_id, p.category_id) AS category_id,
      c.name AS category_name,
      COALESCE(mp.sku, p.sku) AS sku,
      COALESCE(mp.name, p.name) AS name,
      COALESCE(mp.short_description, p.short_description) AS short_description,
      COALESCE(mp.description, p.description) AS description,
      COALESCE(mp.ai_description, p.ai_description) AS ai_description,
      COALESCE(mp.price, p.price) AS price,
      COALESCE(mp.stock_qty, p.stock_qty) AS stock_qty,
      COALESCE(mp.image_url, p.image_url) AS image_url,
      ac.is_out_of_stock,
      ac.snooze_until,
      COALESCE(ac.discount_percent, 0) AS discount_percent,
      COALESCE(ac.gst_percent, 0) AS gst_percent,
      COALESCE(ac.delivery_charge, 0) AS delivery_charge,
      ROUND(
        (COALESCE(mp.price, p.price) * (1 - COALESCE(ac.discount_percent, 0) / 100) * (1 + COALESCE(ac.gst_percent, 0) / 100))
        + COALESCE(ac.delivery_charge, 0)
      , 2) AS final_price
    FROM tb_app_catalogue ac
    JOIN tb_products p ON p.id = ac.product_id
    LEFT JOIN tb_merchant_products mp ON mp.id = ac.override_product_id
    LEFT JOIN tb_categories c ON c.id = COALESCE(mp.category_id, p.category_id)
    WHERE ac.merchant_id = ?
      AND ac.is_available = 1
      AND ac.is_top_selling = 1
      AND COALESCE(mp.is_active, p.is_active) = 1
    ORDER BY p.sort_order ASC, ac.id ASC
  `, params);

  return products;
}

module.exports = {
  getAllActiveStores,
  getStoreBySlug,
  getCategoriesForStore,
  getProductsForStore,
  getTopSellingProductsForStore,
  getMasterbrandSettings,
  getWishlistItems,
  toggleWishlist,
  getCustomerWishlist
};




