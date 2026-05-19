const productService = require('../services/productService');
const { sendSuccess, sendError, sendNotFound } = require('../../../utilities/responseUtil');
const logger = require('../../../utilities/loggingUtil');

const MODULE = 'ProductController';

function formatProductImageUrls(req, productsOrProduct) {
  const host = `${req.protocol}://${req.get('host')}`;
  const formatUrl = (url) => {
    if (url && url.startsWith('/uploads/')) {
      return `${host}${url}`;
    }
    return url;
  };

  const formatItem = (item) => {
    if (!item) return item;
    const formatted = { ...item };
    if (formatted.image_url) formatted.image_url = formatUrl(formatted.image_url);
    if (formatted.effective_image_url) formatted.effective_image_url = formatUrl(formatted.effective_image_url);
    if (formatted.master_image_url) formatted.master_image_url = formatUrl(formatted.master_image_url);
    if (formatted.merchant_image_url) formatted.merchant_image_url = formatUrl(formatted.merchant_image_url);
    return formatted;
  };

  if (Array.isArray(productsOrProduct)) {
    return productsOrProduct.map(formatItem);
  }
  return formatItem(productsOrProduct);
}

function cleanProductImageUrl(url) {
  if (!url) return url;
  const match = url.match(/\/uploads\/[^\/]+$/);
  return match ? match[0] : url;
}

/**
 * Merchant scope resolver lets admin preview merchant inheritance using query params.
 */
function resolveMerchantScope(req) {
  if (req.selloUser.role === 'MERCHANT_ADMIN') {
    return req.selloUser.merchantId;
  }

  return Number(req.query.merchant_id || req.body.merchant_id || 0) || null;
}

/**
 * GET /api/products/master
 * Universal masterbrand catalogue listing.
 */
async function getMasterProducts(req, res) {
  try {
    const { products, total } = await productService.getMasterProducts(req.selloUser.masterbrandId, {
      categoryId: req.query.category_id ? Number(req.query.category_id) : null,
      search: req.query.search || '',
      includeInactive: String(req.query.include_inactive || 'true') === 'true',
      statusFilter: req.query.status_filter || 'all',
      limit: Number(req.query.limit || 10),
      offset: Number(req.query.offset || 0)
    });

    return sendSuccess(res, 'Master products fetched', {
      products: formatProductImageUrls(req, products),
      total
    });
  } catch (err) {
    logger.error(MODULE, 'GET_MASTER_PRODUCTS_ERROR', { error: err.message });
    try {
      const { trackError } = require('../../../utilities/errorTracker');
      await trackError(err, req);
    } catch (e) {}
    return sendError(res, 'Failed to fetch master products', 500);
  }
}

/**
 * POST /api/products/master
 * Creates a universal product and auto-inherits it to all active merchants.
 */
async function createMasterProduct(req, res) {
  try {
    if (req.body.image_url) {
      req.body.image_url = cleanProductImageUrl(req.body.image_url);
    }
    const { id } = await productService.createMasterProduct(req.selloUser.masterbrandId, req.body);
    const product = await productService.getMasterProductById(id, req.selloUser.masterbrandId);
    return sendSuccess(res, 'Master product created successfully', { product: formatProductImageUrls(req, product) }, 201);
  } catch (err) {
    logger.error(MODULE, 'CREATE_MASTER_PRODUCT_ERROR', { error: err.message });
    if (err.code === 'ER_DUP_ENTRY' || err.message.includes('ER_DUP_ENTRY')) {
      return sendError(res, 'SKU already exists. Please use a different SKU code.', 400);
    }
    return sendError(res, 'Failed to create master product', 500);
  }
}

/**
 * PUT /api/products/master/:id
 * Edits the universal source row.
 */
async function updateMasterProduct(req, res) {
  try {
    const productId = Number(req.params.id);
    const existing = await productService.getMasterProductById(productId, req.selloUser.masterbrandId);

    if (!existing) {
      return sendNotFound(res, 'Master product not found');
    }

    if (req.body.image_url) {
      req.body.image_url = cleanProductImageUrl(req.body.image_url);
    }
    await productService.updateMasterProduct(productId, req.selloUser.masterbrandId, req.body);
    const product = await productService.getMasterProductById(productId, req.selloUser.masterbrandId);
    return sendSuccess(res, 'Master product updated successfully', { product: formatProductImageUrls(req, product) });
  } catch (err) {
    logger.error(MODULE, 'UPDATE_MASTER_PRODUCT_ERROR', { error: err.message });
    if (err.code === 'ER_DUP_ENTRY' || err.message.includes('ER_DUP_ENTRY')) {
      return sendError(res, 'SKU already exists. Please use a different SKU code.', 400);
    }
    return sendError(res, 'Failed to update master product', 500);
  }
}

/**
 * DELETE /api/products/master/:id
 * Soft delete on the master row.
 */
async function deleteMasterProduct(req, res) {
  try {
    const productId = Number(req.params.id);
    const existing = await productService.getMasterProductById(productId, req.selloUser.masterbrandId);

    if (!existing) {
      return sendNotFound(res, 'Master product not found');
    }

    await productService.archiveMasterProduct(productId, req.selloUser.masterbrandId);
    return sendSuccess(res, 'Master product deleted successfully');
  } catch (err) {
    logger.error(MODULE, 'DELETE_MASTER_PRODUCT_ERROR', { error: err.message });
    return sendError(res, 'Failed to delete master product', 500);
  }
}

/**
 * POST /api/products/master/:id/duplicate
 * Supports both admin and merchant duplication.
 */
async function duplicateProduct(req, res) {
  try {
    const productId = Number(req.params.id);
    const merchantId = req.selloUser.merchantId || null;
    
    const result = await productService.duplicateProduct(
      productId, 
      req.selloUser.masterbrandId, 
      merchantId
    );
    
    return sendSuccess(res, 'Product duplicated successfully', { product: formatProductImageUrls(req, result) });
  } catch (err) {
    logger.error(MODULE, 'DUPLICATE_PRODUCT_ERROR', { error: err.message });
    return sendError(res, 'Failed to duplicate product', 500);
  }
}

/**
 * DELETE /api/products/merchant/:id
 * Merchant deleting their own override product.
 */
async function deleteMerchantProduct(req, res) {
  try {
    const merchantProductId = Number(req.params.id);
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) return sendError(res, 'Only merchant users can delete overrides');

    await productService.archiveMerchantProduct(merchantProductId, merchantId);
    return sendSuccess(res, 'Merchant product deleted successfully');
  } catch (err) {
    logger.error(MODULE, 'DELETE_MERCHANT_PRODUCT_ERROR', { error: err.message });
    return sendError(res, 'Failed to delete merchant product', 500);
  }
}

/**
 * GET /api/products/inherited
 * Shows the effective product data a merchant will actually use.
 */
async function getInheritedProducts(req, res) {
  try {
    const merchantId = resolveMerchantScope(req);
    if (!merchantId) {
      return sendError(res, 'merchant_id is required for this request');
    }

    const { products, total } = await productService.getInheritedProducts(merchantId, {
      categoryId: req.query.category_id ? Number(req.query.category_id) : null,
      search: req.query.search || '',
      includeUnavailable: String(req.query.include_unavailable || 'true') === 'true',
      statusFilter: req.query.status_filter || 'all',
      limit: Number(req.query.limit || 10),
      offset: Number(req.query.offset || 0)
    });

    return sendSuccess(res, 'Inherited products fetched', {
      products: formatProductImageUrls(req, products),
      total
    });
  } catch (err) {
    logger.error(MODULE, 'GET_INHERITED_PRODUCTS_ERROR', { error: err.message });
    try {
      const { trackError } = require('../../../utilities/errorTracker');
      await trackError(err, req);
    } catch (e) {}
    return sendError(res, 'Failed to fetch inherited products', 500);
  }
}

/**
 * POST /api/products/inherited/:catalogueId/delink
 * Creates the merchant-owned copy if one does not already exist.
 */
async function delinkProduct(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) {
      return sendError(res, 'Only merchant users can delink products');
    }

    const result = await productService.delinkProduct(Number(req.params.catalogueId), merchantId);
    const merchantProduct = await productService.getMerchantProductById(result.merchantProductId, merchantId);

    return sendSuccess(
      res,
      result.alreadyDelinked ? 'Product was already delinked' : 'Product delinked successfully',
      { merchantProduct: formatProductImageUrls(req, merchantProduct) }
    );
  } catch (err) {
    logger.error(MODULE, 'DELINK_PRODUCT_ERROR', { error: err.message });
    return sendError(res, err.message === 'Catalogue item not found' ? err.message : 'Failed to delink product', err.message === 'Catalogue item not found' ? 404 : 500);
  }
}

/**
 * POST /api/products/inherited/:catalogueId/relink
 * Drops the merchant-owned copy and reverts to master data.
 */
async function relinkProduct(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) {
      return sendError(res, 'Only merchant users can relink products');
    }

    await productService.relinkProduct(Number(req.params.catalogueId), merchantId);
    return sendSuccess(res, 'Product relinked to masterbrand successfully');
  } catch (err) {
    logger.error(MODULE, 'RELINK_PRODUCT_ERROR', { error: err.message });
    return sendError(res, 'Failed to relink product', 500);
  }
}

/**
 * PUT /api/products/merchant/:id
 * Merchant edits are isolated to the delinked copy.
 */
async function updateMerchantProduct(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) {
      return sendError(res, 'Only merchant users can edit delinked products');
    }

    const merchantProductId = Number(req.params.id);
    const existing = await productService.getMerchantProductById(merchantProductId, merchantId);
    if (!existing) {
      return sendNotFound(res, 'Merchant product not found');
    }

    if (req.body.image_url) {
      req.body.image_url = cleanProductImageUrl(req.body.image_url);
    }
    await productService.updateMerchantProduct(merchantProductId, merchantId, req.body);
    const product = await productService.getMerchantProductById(merchantProductId, merchantId);
    return sendSuccess(res, 'Merchant product updated successfully', { product: formatProductImageUrls(req, product) });
  } catch (err) {
    logger.error(MODULE, 'UPDATE_MERCHANT_PRODUCT_ERROR', { error: err.message });
    if (err.code === 'ER_DUP_ENTRY' || err.message.includes('ER_DUP_ENTRY')) {
      return sendError(res, 'SKU already exists. Please use a different SKU code.', 400);
    }
    return sendError(res, 'Failed to update merchant product', 500);
  }
}

/**
 * POST /api/products/merchant
 * Creates a merchant-only private product.
 */
async function createMerchantProduct(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) {
      return sendError(res, 'Only merchant users can create private products');
    }

    if (req.body.image_url) {
      req.body.image_url = cleanProductImageUrl(req.body.image_url);
    }
    const { id } = await productService.createPrivateProduct(
      req.selloUser.masterbrandId,
      merchantId,
      req.body
    );
    
    return sendSuccess(res, 'Private product created successfully', { id }, 201);
  } catch (err) {
    logger.error(MODULE, 'CREATE_MERCHANT_PRODUCT_ERROR', { error: err.message });
    if (err.code === 'ER_DUP_ENTRY' || err.message.includes('ER_DUP_ENTRY')) {
      return sendError(res, 'SKU already exists. Please use a different SKU code.', 400);
    }
    return sendError(res, 'Failed to create private product', 500);
  }
}

/**
 * POST /api/products/upload
 * Handles product image uploads using multer.
 */
async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return sendError(res, 'No file uploaded', 400);
    }
    const host = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${host}/uploads/${req.file.filename}`;
    return sendSuccess(res, 'Image uploaded successfully', { imageUrl });
  } catch (err) {
    logger.error(MODULE, 'UPLOAD_IMAGE_ERROR', { error: err.message });
    return sendError(res, 'Failed to upload image', 500);
  }
}

async function updateStockStatus(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) return sendError(res, 'Only merchants can update stock status');

    const catalogueId = Number(req.params.catalogueId);
    const { is_out_of_stock } = req.body;

    await productService.updateCatalogueStockStatus(catalogueId, merchantId, is_out_of_stock);
    return sendSuccess(res, 'Stock status updated successfully');
  } catch (err) {
    logger.error(MODULE, 'UPDATE_STOCK_STATUS_ERROR', { error: err.message });
    return sendError(res, 'Failed to update stock status', 500);
  }
}

/**
 * POST /api/products/generate-description
 * Uses Gemini API to generate a description.
 */
async function generateDescription(req, res) {
  try {
    const { product_name, category_name } = req.body;
    const description = await productService.generateAiDescription(product_name, category_name);
    return sendSuccess(res, 'Description generated', { description });
  } catch (err) {
    logger.error(MODULE, 'GENERATE_DESCRIPTION_ERROR', { error: err.message });
    return sendError(res, 'Failed to generate description', 500);
  }
}


/**
 * POST /api/products/swap
 * Exchanges sort_order between two products.
 */
async function swapProducts(req, res) {
  try {
    const { id1, id2 } = req.body;
    if (!id1 || !id2) return sendError(res, 'Both id1 and id2 are required');

    await productService.swapProducts(req.selloUser.masterbrandId, id1, id2);
    return sendSuccess(res, 'Products swapped successfully');
  } catch (err) {
    logger.error(MODULE, 'SWAP_PRODUCTS_ERROR', { error: err.message });
    return sendError(res, err.message);
  }
}

module.exports = {
  getMasterProducts,
  createMasterProduct,
  updateMasterProduct,
  deleteMasterProduct,
  getInheritedProducts,
  delinkProduct,
  updateMerchantProduct,
  createMerchantProduct,
  generateDescription,
  relinkProduct,
  swapProducts,
  duplicateProduct,
  deleteMerchantProduct,
  updateStockStatus,
  uploadImage,
  getSearchSuggestions,
  snoozeCatalogItems,
  unsnoozeCatalogItems
};

async function getSearchSuggestions(req, res) {
  try {
    const query = req.query.search || '';
    if (!query) return sendSuccess(res, 'Suggestions fetched', { suggestions: [] });
    
    const suggestions = await productService.getSearchSuggestions(req.selloUser, query);
    return sendSuccess(res, 'Suggestions fetched', { suggestions });
  } catch (err) {
    logger.error(MODULE, 'GET_SUGGESTIONS_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch suggestions', 500);
  }
}

async function snoozeCatalogItems(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) {
      return sendError(res, 'Only merchant users can snooze catalog items');
    }

    const { type, ids, snooze_until } = req.body;
    if (!type || !ids || !ids.length || !snooze_until) {
      return sendError(res, 'type, ids (array), and snooze_until are required', 400);
    }

    await productService.snoozeItems(merchantId, { type, ids, snoozeUntil: snooze_until });
    return sendSuccess(res, 'Catalog items snoozed successfully');
  } catch (err) {
    logger.error(MODULE, 'SNOOZE_ITEMS_ERROR', { error: err.message });
    return sendError(res, err.message || 'Failed to snooze items', 500);
  }
}

async function unsnoozeCatalogItems(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) {
      return sendError(res, 'Only merchant users can unsnooze catalog items');
    }

    const { type, ids } = req.body;
    if (!type || !ids || !ids.length) {
      return sendError(res, 'type and ids (array) are required', 400);
    }

    await productService.unsnoozeItems(merchantId, { type, ids });
    return sendSuccess(res, 'Catalog items unsnoozed successfully');
  } catch (err) {
    logger.error(MODULE, 'UNSNOOZE_ITEMS_ERROR', { error: err.message });
    return sendError(res, err.message || 'Failed to unsnooze items', 500);
  }
}
