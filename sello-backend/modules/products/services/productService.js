const db = require('../../../database/mysqlLib');
const logger = require('../../../utilities/loggingUtil');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODULE = 'ProductService';

/**
 * Masterbrand product listing used by the admin dashboard.
 */
async function getMasterProducts(masterbrandId, { categoryId = null, search = '', includeInactive = true, statusFilter = 'all', limit = 10, offset = 0 } = {}) {
  const params = [masterbrandId];
  let whereSql = 'WHERE p.masterbrand_id = ? AND p.is_deleted = 0';

  if (statusFilter === 'enabled') {
    whereSql += ' AND p.is_active = 1';
  } else if (statusFilter === 'disabled') {
    whereSql += ' AND p.is_active = 0';
  } else if (!includeInactive) {
    whereSql += ' AND p.is_active = 1';
  }
  if (categoryId) {
    whereSql += ' AND p.category_id = ?';
    params.push(categoryId);
  }
  if (search) {
    whereSql += ' AND (p.id LIKE ? OR p.name LIKE ? OR p.sku LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const countRows = await db.query(`SELECT COUNT(*) as total FROM tb_products p ${whereSql}`, params);
  const total = countRows[0].total;

  const dataParams = [...params, Number(limit), Number(offset)];
  const products = await db.query(`
    SELECT
      p.id,
      p.masterbrand_id,
      p.category_id,
      p.sku,
      p.name,
      p.short_description,
      p.description,
      p.ai_description,
      p.price,
      p.stock_qty,
      p.image_url,
      p.sort_order,
      p.is_active,
      p.created_at,
      c.name AS category_name
    FROM tb_products p
    LEFT JOIN tb_categories c ON c.id = p.category_id
    ${whereSql}
    ORDER BY p.sort_order ASC, p.created_at DESC
    LIMIT ? OFFSET ?
  `, dataParams);

  return { products, total };
}

/**
 * Master product lookup powers edit flows and order resolution.
 */
async function getMasterProductById(productId, masterbrandId) {
  const rows = await db.query(`
    SELECT
      p.*,
      c.name AS category_name
    FROM tb_products p
    LEFT JOIN tb_categories c ON c.id = p.category_id
    WHERE p.id = ? AND p.masterbrand_id = ?
    LIMIT 1
  `, [productId, masterbrandId]);

  return rows[0] || null;
}

/**
 * New master products are immediately inherited by all active merchants through tb_app_catalogue.
 */
async function createMasterProduct(masterbrandId, product) {
  return db.transaction(async (query) => {
    let sku = product.sku;
    if (!sku) {
      const namePrefix = (product.name || 'PRD').trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
      const ts = Date.now().toString(36).toUpperCase();
      const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
      sku = `SKU-${namePrefix}-${ts}-${rand}`;
    }

    const result = await query(
      `INSERT INTO tb_products
        (masterbrand_id, category_id, sku, name, short_description, description, ai_description, price, stock_qty, image_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        masterbrandId,
        product.category_id,
        sku,
        product.name,
        product.short_description || null,
        product.description || null,
        product.ai_description || null,
        product.price,
        product.stock_qty ?? 0,
        product.image_url || null,
        product.sort_order ?? 0,
        product.is_active === undefined ? 1 : Number(Boolean(product.is_active))
      ]
    );

    await query(
      `INSERT INTO tb_app_catalogue (merchant_id, product_id, source_type, is_available)
       SELECT id, ?, 'MASTER', 1
       FROM tb_merchants
       WHERE masterbrand_id = ? AND is_active = 1`,
      [result.insertId, masterbrandId]
    );

    logger.info(MODULE, 'MASTER_PRODUCT_CREATED', {
      productId: result.insertId,
      masterbrandId,
      sku: sku
    });

    return { id: result.insertId };
  });
}

/**
 * Admin edits always touch the universal tb_products row only.
 */
async function updateMasterProduct(productId, masterbrandId, fields) {
  const allowed = [
    'category_id',
    'sku',
    'name',
    'short_description',
    'description',
    'ai_description',
    'price',
    'stock_qty',
    'image_url',
    'sort_order',
    'is_active'
  ];

  const updates = [];
  const params = [];

  allowed.forEach((key) => {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(fields[key] === '' ? null : fields[key]);
    }
  });

  if (!updates.length) {
    return;
  }

  params.push(productId, masterbrandId);
  await db.query(
    `UPDATE tb_products SET ${updates.join(', ')} WHERE id = ? AND masterbrand_id = ?`,
    params
  );

  logger.info(MODULE, 'MASTER_PRODUCT_UPDATED', { productId, masterbrandId });
}

/**
 * Soft delete by marking is_deleted = 1.
 */
async function archiveMasterProduct(productId, masterbrandId) {
  await db.query(
    'UPDATE tb_products SET is_deleted = 1, is_active = 0 WHERE id = ? AND masterbrand_id = ?',
    [productId, masterbrandId]
  );
  logger.info(MODULE, 'MASTER_PRODUCT_SOFT_DELETED', { productId, masterbrandId });
}

/**
 * Marks a merchant-owned product as deleted.
 */
async function archiveMerchantProduct(merchantProductId, merchantId) {
  await db.query(
    'UPDATE tb_merchant_products SET is_deleted = 1, is_active = 0 WHERE id = ? AND merchant_id = ?',
    [merchantProductId, merchantId]
  );
  logger.info(MODULE, 'MERCHANT_PRODUCT_SOFT_DELETED', { merchantProductId, merchantId });
}

/**
 * Creates a copy of an existing product (master or merchant-owned).
 * If merchantId is provided, the copy becomes a private product for that merchant.
 */
async function duplicateProduct(productId, masterbrandId, merchantId = null) {
  // If merchantId is provided, it might be a master product or a private product being duplicated.
  // For simplicity, we fetch the "effective" data.
  
  const source = await db.query('SELECT * FROM tb_products WHERE id = ? AND masterbrand_id = ?', [productId, masterbrandId]);
  if (!source[0]) throw new Error('Source product not found');

  const p = source[0];
  const copy = {
    category_id: p.category_id,
    sku: `${p.sku}-${Math.floor(Math.random() * 10000)}`,
    name: `${p.name} (Copy)`,
    short_description: p.short_description,
    description: p.description,
    ai_description: p.ai_description,
    price: p.price,
    stock_qty: p.stock_qty,
    image_url: p.image_url,
    sort_order: (p.sort_order || 0) + 1,
    is_active: 1
  };

  if (merchantId) {
    return createPrivateProduct(masterbrandId, merchantId, copy);
  } else {
    return createMasterProduct(masterbrandId, copy);
  }
}

/**
 * Effective merchant catalogue view with both master and delinked values.
 */
async function getInheritedProducts(merchantId, { categoryId = null, search = '', includeUnavailable = true, statusFilter = 'all', limit = 10, offset = 0 } = {}) {
  const params = [merchantId];
  let whereSql = 'WHERE ac.merchant_id = ? AND p.is_deleted = 0';

  if (!includeUnavailable) {
    whereSql += ' AND ac.is_available = 1';
  }
  if (statusFilter === 'enabled') {
    whereSql += ' AND COALESCE(mp.is_active, p.is_active) = 1';
  } else if (statusFilter === 'disabled') {
    whereSql += ' AND COALESCE(mp.is_active, p.is_active) = 0';
  }
  if (categoryId) {
    whereSql += ' AND COALESCE(mp.category_id, p.category_id) = ?';
    params.push(categoryId);
  }
  if (search) {
    whereSql += ' AND (ac.product_id LIKE ? OR COALESCE(mp.name, p.name) LIKE ? OR COALESCE(mp.sku, p.sku) LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const countRows = await db.query(`
    SELECT COUNT(*) as total
    FROM tb_app_catalogue ac
    JOIN tb_products p ON p.id = ac.product_id
    LEFT JOIN tb_merchant_products mp ON mp.id = ac.override_product_id
    ${whereSql}
  `, params);
  const total = countRows[0].total;

  const dataParams = [...params, Number(limit), Number(offset)];
  const products = await db.query(`
    SELECT
      ac.id AS catalogue_id,
      ac.merchant_id,
      ac.product_id AS master_product_id,
      ac.override_product_id AS merchant_product_id,
      ac.source_type,
      ac.is_available,
      p.category_id AS master_category_id,
      p.sku AS master_sku,
      p.name AS master_name,
      p.short_description AS master_short_description,
      p.description AS master_description,
      p.ai_description AS master_ai_description,
      p.price AS master_price,
      p.stock_qty AS master_stock_qty,
      p.image_url AS master_image_url,
      p.is_active AS master_is_active,
      mp.category_id AS merchant_category_id,
      mp.sku AS merchant_sku,
      mp.name AS merchant_name,
      mp.short_description AS merchant_short_description,
      mp.description AS merchant_description,
      mp.ai_description AS merchant_ai_description,
      mp.price AS merchant_price,
      mp.stock_qty AS merchant_stock_qty,
      mp.image_url AS merchant_image_url,
      mp.is_active AS merchant_is_active,
      mp.is_delinked,
      COALESCE(mp.category_id, p.category_id) AS effective_category_id,
      COALESCE(mp.sku, p.sku) AS effective_sku,
      COALESCE(mp.name, p.name) AS effective_name,
      COALESCE(mp.short_description, p.short_description) AS effective_short_description,
      COALESCE(mp.description, p.description) AS effective_description,
      COALESCE(mp.ai_description, p.ai_description) AS effective_ai_description,
      COALESCE(mp.price, p.price) AS effective_price,
      COALESCE(mp.stock_qty, p.stock_qty) AS effective_stock_qty,
      COALESCE(mp.image_url, p.image_url) AS effective_image_url,
      COALESCE(mp.is_active, p.is_active) AS effective_is_active,
      ac.is_out_of_stock,
      c.name AS category_name
    FROM tb_app_catalogue ac
    JOIN tb_products p ON p.id = ac.product_id
    LEFT JOIN tb_merchant_products mp ON mp.id = ac.override_product_id
    LEFT JOIN tb_categories c ON c.id = COALESCE(mp.category_id, p.category_id)
    ${whereSql}
    ORDER BY p.sort_order ASC, ac.id ASC
    LIMIT ? OFFSET ?
  `, dataParams);

  return { products, total };
}

/**
 * Merchant copy lookup for edit forms.
 */
async function getMerchantProductById(merchantProductId, merchantId) {
  const rows = await db.query(`
    SELECT
      mp.*,
      c.name AS category_name
    FROM tb_merchant_products mp
    LEFT JOIN tb_categories c ON c.id = mp.category_id
    WHERE mp.id = ? AND mp.merchant_id = ?
    LIMIT 1
  `, [merchantProductId, merchantId]);

  return rows[0] || null;
}

/**
 * Delink copies the current master product snapshot into tb_merchant_products and rewires the bridge row.
 */
async function delinkProduct(catalogueId, merchantId) {
  return db.transaction(async (query) => {
    const catalogueRows = await query(`
      SELECT
        ac.id,
        ac.merchant_id,
        ac.product_id,
        ac.override_product_id,
        ac.source_type,
        p.category_id,
        p.sku,
        p.name,
        p.short_description,
        p.description,
        p.ai_description,
        p.price,
        p.stock_qty,
        p.image_url,
        p.is_active
      FROM tb_app_catalogue ac
      JOIN tb_products p ON p.id = ac.product_id
      WHERE ac.id = ? AND ac.merchant_id = ?
      LIMIT 1
    `, [catalogueId, merchantId]);

    const catalogue = catalogueRows[0];
    if (!catalogue) {
      throw new Error('Catalogue item not found');
    }

    if (catalogue.override_product_id) {
      return { merchantProductId: catalogue.override_product_id, alreadyDelinked: true };
    }

    // Check for existing orphaned merchant product row for this merchant/source pair
    const existingMerchantProduct = await query(
      `SELECT id FROM tb_merchant_products 
       WHERE merchant_id = ? AND source_product_id = ? AND is_deleted = 0
       LIMIT 1`,
      [merchantId, catalogue.product_id]
    );

    let merchantProductId;

    if (existingMerchantProduct[0]) {
      merchantProductId = existingMerchantProduct[0].id;
      // Ensure it is marked as delinked
      await query(
        `UPDATE tb_merchant_products SET is_delinked = 1 WHERE id = ?`,
        [merchantProductId]
      );
    } else {
      const merchantProductResult = await query(
        `INSERT INTO tb_merchant_products
          (merchant_id, source_product_id, category_id, sku, name, short_description, description, ai_description, price, stock_qty, image_url, is_active, is_delinked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          merchantId,
          catalogue.product_id,
          catalogue.category_id,
          catalogue.sku,
          catalogue.name,
          catalogue.short_description || null,
          catalogue.description || null,
          catalogue.ai_description || null,
          catalogue.price,
          catalogue.stock_qty,
          catalogue.image_url || null,
          catalogue.is_active
        ]
      );
      merchantProductId = merchantProductResult.insertId;
    }

    await query(
      `UPDATE tb_app_catalogue
       SET override_product_id = ?, source_type = 'MERCHANT'
       WHERE id = ? AND merchant_id = ?`,
      [merchantProductId, catalogueId, merchantId]
    );

    await query(
      `INSERT INTO tb_notifications (merchant_id, title, message, type)
       VALUES (?, 'Product delinked', ?, 'WARNING')`,
      [
        merchantId,
        `Product "${catalogue.name}" was delinked. Future edits for this merchant will now stay inside tb_merchant_products.`
      ]
    );

    logger.info(MODULE, 'PRODUCT_DELINKED', {
      merchantId,
      catalogueId,
      merchantProductId
    });

    return { merchantProductId, alreadyDelinked: false };
  });
}

/**
 * Merchant edits are scoped to the copied row only, preserving the masterbrand source row.
 */
async function updateMerchantProduct(merchantProductId, merchantId, fields) {
  const allowed = [
    'category_id',
    'name',
    'short_description',
    'description',
    'ai_description',
    'price',
    'stock_qty',
    'image_url',
    'is_active'
  ];

  const updates = [];
  const params = [];

  allowed.forEach((key) => {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(fields[key] === '' ? null : fields[key]);
    }
  });

  if (!updates.length) {
    return;
  }

  params.push(merchantProductId, merchantId);
  await db.query(
    `UPDATE tb_merchant_products SET ${updates.join(', ')} WHERE id = ? AND merchant_id = ?`,
    params
  );

  logger.info(MODULE, 'MERCHANT_PRODUCT_UPDATED', { merchantProductId, merchantId });
}

/**
 * Generates an AI description using Google Gemini API.
 */
async function generateAiDescription(productName, categoryName) {
  if (!process.env.GEMINI_API_KEY) {
    const categoryFragment = categoryName ? `${categoryName.toLowerCase()} ` : '';
    return `${productName} is a ${categoryFragment}catalogue item designed for clean presentation, reliable repeat demand, and merchant-friendly merchandising. This demo AI copy helps the Selo mini project show how automated descriptions can speed up product onboarding.`;
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `Write a short, professional, and compelling e-commerce product description for an item named "${productName}". The category is "${categoryName || 'General'}". Make it 2-3 sentences long and focus on quality and merchant appeal. Return ONLY the description text without quotes or formatting.`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    logger.error(MODULE, 'GEMINI_API_ERROR', { error: error.message });
    return `Fallback description: ${productName} - high quality product.`;
  }
}



/**
 * Private products are created by merchants and are NOT inherited or visible globally.
 */
async function createPrivateProduct(masterbrandId, merchantId, product) {
  return db.transaction(async (query) => {
    let sku = product.sku;
    if (!sku) {
      const namePrefix = (product.name || 'PRD').trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
      const ts = Date.now().toString(36).toUpperCase();
      const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
      sku = `SKU-${namePrefix}-${ts}-${rand}`;
    }

    const result = await query(
      `INSERT INTO tb_products
        (masterbrand_id, merchant_id, category_id, sku, name, short_description, description, ai_description, price, stock_qty, image_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        masterbrandId,
        merchantId,
        product.category_id,
        sku,
        product.name,
        product.short_description || null,
        product.description || null,
        product.ai_description || null,
        product.price,
        product.stock_qty ?? 0,
        product.image_url || null,
        product.sort_order ?? 0,
        product.is_active === undefined ? 1 : Number(Boolean(product.is_active))
      ]
    );

    await query(
      `INSERT INTO tb_app_catalogue (merchant_id, product_id, source_type, is_available)
       VALUES (?, ?, 'MERCHANT', 1)`,
      [merchantId, result.insertId]
    );

    logger.info(MODULE, 'PRIVATE_PRODUCT_CREATED', {
      productId: result.insertId,
      merchantId,
      sku: sku
    });

    return { id: result.insertId };
  });
}

/**
 * Exchanges sort_order values between two products to support drag-and-drop.
 */
async function swapProducts(masterbrandId, id1, id2) {
  return db.transaction(async (query) => {
    // 1. Fetch all active products ordered by sort_order
    const allProducts = await query(
      'SELECT id, sort_order FROM tb_products WHERE masterbrand_id = ? AND is_deleted = 0 ORDER BY sort_order ASC, created_at ASC',
      [masterbrandId]
    );

    // 2. Normalize and assign unique sequential sort orders
    for (let i = 0; i < allProducts.length; i++) {
      const prod = allProducts[i];
      prod.sort_order = i * 10;
      await query('UPDATE tb_products SET sort_order = ? WHERE id = ?', [prod.sort_order, prod.id]);
    }

    // 3. Find our target products within the updated set
    const p1 = allProducts.find(r => r.id === Number(id1));
    const p2 = allProducts.find(r => r.id === Number(id2));

    if (!p1 || !p2) {
      throw new Error('Both products must exist and belong to the same masterbrand');
    }

    // 4. Swap their unique sort orders
    await query('UPDATE tb_products SET sort_order = ? WHERE id = ?', [p2.sort_order, p1.id]);
    await query('UPDATE tb_products SET sort_order = ? WHERE id = ?', [p1.sort_order, p2.id]);

    logger.info(MODULE, 'PRODUCTS_SWAPPED', { id1, id2, masterbrandId });
  });
}

async function updateCatalogueStockStatus(catalogueId, merchantId, isOutOfStock) {
  await db.query(
    'UPDATE tb_app_catalogue SET is_out_of_stock = ? WHERE id = ? AND merchant_id = ?',
    [isOutOfStock ? 1 : 0, catalogueId, merchantId]
  );
  logger.info(MODULE, 'CATALOGUE_STOCK_STATUS_UPDATED', { catalogueId, merchantId, isOutOfStock });
}

module.exports = {
  getMasterProducts,
  getMasterProductById,
  createMasterProduct,
  createPrivateProduct,
  updateMasterProduct,
  archiveMasterProduct,
  getInheritedProducts,
  getMerchantProductById,
  delinkProduct,
  updateMerchantProduct,
  generateAiDescription,
  relinkProduct,
  swapProducts,
  duplicateProduct,
  archiveMerchantProduct,
  updateCatalogueStockStatus
};
/**
 * Relink removes the merchant override and returns the catalogue item to follow masterbrand data.
 */
async function relinkProduct(catalogueId, merchantId) {
  await db.query(
    `UPDATE tb_app_catalogue
     SET override_product_id = NULL, source_type = 'MASTER'
     WHERE id = ? AND merchant_id = ?`,
    [catalogueId, merchantId]
  );

  logger.info(MODULE, 'PRODUCT_RELINKED', { merchantId, catalogueId });
}
