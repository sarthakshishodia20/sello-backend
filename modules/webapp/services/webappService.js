const db = require('../../../database/mysqlLib');
const { buildCategoryTree } = require('../../catalog/services/catalogService');

/**
 * Public store discovery page with lightweight merchant stats.
 */
async function getAllActiveStores() {
  return db.query(`
    SELECT
      m.id,
      m.name AS store_name,
      m.slug AS store_slug,
      m.description,
      m.contact_email,
      m.phone,
      m.address,
      m.theme_color,
      m.created_at,
      COALESCE(cat.total_products, 0) AS total_products
    FROM tb_merchants m
    LEFT JOIN (
      SELECT merchant_id, COUNT(*) AS total_products
      FROM tb_app_catalogue
      WHERE is_available = 1
      GROUP BY merchant_id
    ) cat ON cat.merchant_id = m.id
    WHERE m.is_active = 1
    ORDER BY m.name ASC
  `);
}

/**
 * Store hero data used by the webapp storefront page.
 */
async function getStoreBySlug(slug) {
  const rows = await db.query(`
    SELECT
      m.id,
      m.masterbrand_id,
      m.name AS store_name,
      m.slug AS store_slug,
      m.description,
      m.contact_email,
      m.phone,
      m.address,
      m.theme_color
    FROM tb_merchants m
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
      COALESCE(mp.image_url, p.image_url) AS image_url
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

module.exports = {
  getAllActiveStores,
  getStoreBySlug,
  getCategoriesForStore,
  getProductsForStore
};
