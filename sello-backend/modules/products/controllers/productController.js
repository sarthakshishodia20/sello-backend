const productService              = require('../services/productService');
const { sendSuccess, sendError, sendNotFound } = require('../../../utilities/responseUtil');
const { trackError }              = require('../../../utilities/errorTracker');
const { formatImageUrls, cleanImageUrl } = require('../../../utilities/imageUtil');
const logger                      = require('../../../utilities/loggingUtil');
const fs                          = require('fs');
const cloudinary                  = require('cloudinary').v2;

const MODULE = 'ProductController';

// Configure Cloudinary only if environment variables are set
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}


// ─── Private Helpers ─────────────────────────────────────────────────────────

/**
 * Merchant scope resolver lets admin preview merchant inheritance using query params.
 * MERCHANT_ADMIN users are always scoped to their own merchantId.
 */
function resolveMerchantScope(req) {
  if (req.selloUser.role === 'MERCHANT_ADMIN') {
    return req.selloUser.merchantId;
  }
  return Number(req.query.merchant_id || req.body.merchant_id || 0) || null;
}

// ─── Master Product Handlers ──────────────────────────────────────────────────

/**
 * GET /api/products/master
 * Universal masterbrand catalogue listing.
 */
async function getMasterProducts(req, res) {
  try {
    const { products, total } = await productService.getMasterProducts(req.selloUser.masterbrandId, {
      categoryId:      req.query.category_id ? Number(req.query.category_id) : null,
      search:          req.query.search || '',
      includeInactive: String(req.query.include_inactive || 'true') === 'true',
      statusFilter:    req.query.status_filter || 'all',
      limit:           Number(req.query.limit || 10),
      offset:          Number(req.query.offset || 0)
    });

    return sendSuccess(res, 'Master products fetched', {
      products: formatImageUrls(req, products),
      total
    });
  } catch (err) {
    logger.error(MODULE, 'GET_MASTER_PRODUCTS_ERROR', { error: err.message });
    await trackError(err, req);
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
      req.body.image_url = cleanImageUrl(req.body.image_url);
    }
    const { id } = await productService.createMasterProduct(req.selloUser.masterbrandId, req.body);
    const product = await productService.getMasterProductById(id, req.selloUser.masterbrandId);
    return sendSuccess(res, 'Master product created successfully', { product: formatImageUrls(req, product) }, 201);
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
    const existing  = await productService.getMasterProductById(productId, req.selloUser.masterbrandId);

    if (!existing) {
      return sendNotFound(res, 'Master product not found');
    }

    if (req.body.image_url) {
      req.body.image_url = cleanImageUrl(req.body.image_url);
    }
    await productService.updateMasterProduct(productId, req.selloUser.masterbrandId, req.body);
    const product = await productService.getMasterProductById(productId, req.selloUser.masterbrandId);
    return sendSuccess(res, 'Master product updated successfully', { product: formatImageUrls(req, product) });
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
    const existing  = await productService.getMasterProductById(productId, req.selloUser.masterbrandId);

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
    const productId  = Number(req.params.id);
    const merchantId = req.selloUser.merchantId || null;

    const result = await productService.duplicateProduct(productId, req.selloUser.masterbrandId, merchantId);
    return sendSuccess(res, 'Product duplicated successfully', { product: formatImageUrls(req, result) });
  } catch (err) {
    logger.error(MODULE, 'DUPLICATE_PRODUCT_ERROR', { error: err.message });
    return sendError(res, 'Failed to duplicate product', 500);
  }
}

// ─── Merchant / Inherited Product Handlers ────────────────────────────────────

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
      categoryId:        req.query.category_id ? Number(req.query.category_id) : null,
      search:            req.query.search || '',
      includeUnavailable: String(req.query.include_unavailable || 'true') === 'true',
      statusFilter:      req.query.status_filter || 'all',
      snoozeFilter:      req.query.snooze_filter || null,
      limit:             Number(req.query.limit || 10),
      offset:            Number(req.query.offset || 0)
    });

    return sendSuccess(res, 'Inherited products fetched', {
      products: formatImageUrls(req, products),
      total
    });
  } catch (err) {
    logger.error(MODULE, 'GET_INHERITED_PRODUCTS_ERROR', { error: err.message });
    await trackError(err, req);
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
      { merchantProduct: formatImageUrls(req, merchantProduct) }
    );
  } catch (err) {
    logger.error(MODULE, 'DELINK_PRODUCT_ERROR', { error: err.message });
    const isNotFound = err.message === 'Catalogue item not found';
    return sendError(res, isNotFound ? err.message : 'Failed to delink product', isNotFound ? 404 : 500);
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
    const existing          = await productService.getMerchantProductById(merchantProductId, merchantId);
    if (!existing) {
      return sendNotFound(res, 'Merchant product not found');
    }

    if (req.body.image_url) {
      req.body.image_url = cleanImageUrl(req.body.image_url);
    }
    await productService.updateMerchantProduct(merchantProductId, merchantId, req.body);
    const product = await productService.getMerchantProductById(merchantProductId, merchantId);
    return sendSuccess(res, 'Merchant product updated successfully', { product: formatImageUrls(req, product) });
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
      req.body.image_url = cleanImageUrl(req.body.image_url);
    }
    const { id } = await productService.createPrivateProduct(req.selloUser.masterbrandId, merchantId, req.body);
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
 * DELETE /api/products/merchant/:id
 * Merchant deleting their own override product.
 */
async function deleteMerchantProduct(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) return sendError(res, 'Only merchant users can delete overrides');

    await productService.archiveMerchantProduct(Number(req.params.id), merchantId);
    return sendSuccess(res, 'Merchant product deleted successfully');
  } catch (err) {
    logger.error(MODULE, 'DELETE_MERCHANT_PRODUCT_ERROR', { error: err.message });
    return sendError(res, 'Failed to delete merchant product', 500);
  }
}

// ─── Catalogue / Stock Handlers ───────────────────────────────────────────────

/**
 * PUT /api/products/inherited/:catalogueId/stock-status
 */
async function updateStockStatus(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) return sendError(res, 'Only merchants can update stock status');

    const { is_out_of_stock } = req.body;
    await productService.updateCatalogueStockStatus(Number(req.params.catalogueId), merchantId, is_out_of_stock);
    return sendSuccess(res, 'Stock status updated successfully');
  } catch (err) {
    logger.error(MODULE, 'UPDATE_STOCK_STATUS_ERROR', { error: err.message });
    return sendError(res, 'Failed to update stock status', 500);
  }
}

/**
 * POST /api/products/snooze
 */
async function snoozeCatalogItems(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) return sendError(res, 'Only merchant users can snooze catalog items');

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

/**
 * POST /api/products/unsnooze
 */
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

async function toggleTopSellingProducts(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) return sendError(res, 'Only merchant users can update top selling status');

    const { catalogueIds, is_top_selling, isTopSelling } = req.body;
    if (!catalogueIds || !catalogueIds.length) {
      return sendError(res, 'catalogueIds (array) is required', 400);
    }

    const activeStatus = is_top_selling !== undefined ? is_top_selling : isTopSelling;
    await productService.updateTopSellingStatus(merchantId, catalogueIds, activeStatus);
    return sendSuccess(res, 'Products top selling status updated successfully');
  } catch (err) {
    logger.error(MODULE, 'TOGGLE_TOP_SELLING_ERROR', { error: err.message });
    return sendError(res, err.message || 'Failed to update top selling status', 500);
  }
}

/**
 * GET /api/products/category-snooze
 */
async function getCategorySnoozeStatus(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) return sendError(res, 'Merchant access required', 403);

    const result = await productService.getCategorySnoozeStatus(merchantId);
    return sendSuccess(res, 'Category snooze status fetched', { categories: result });
  } catch (err) {
    logger.error(MODULE, 'GET_CAT_SNOOZE_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch category snooze status', 500);
  }
}

// ─── Order Settings: Bulk Update Controllers ──────────────────────────────────

/**
 * POST /api/products/bulk/discount
 * Bulk set discount_percent on selected catalogue items for the merchant.
 */
async function bulkUpdateDiscount(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) return sendError(res, 'Only merchant users can update discount settings', 403);

    const { catalogueIds, discountPercent } = req.body;
    if (!catalogueIds || !catalogueIds.length) {
      return sendError(res, 'catalogueIds (array) is required', 400);
    }
    if (discountPercent === undefined || discountPercent === null || isNaN(Number(discountPercent))) {
      return sendError(res, 'discountPercent is required and must be a number', 400);
    }
    const pct = Math.max(0, Math.min(100, Number(discountPercent)));
    await productService.bulkUpdateDiscount(merchantId, catalogueIds, pct);
    return sendSuccess(res, `Discount of ${pct}% applied to ${catalogueIds.length} product(s)`);
  } catch (err) {
    logger.error(MODULE, 'BULK_UPDATE_DISCOUNT_ERROR', { error: err.message });
    return sendError(res, 'Failed to update discount', 500);
  }
}

/**
 * POST /api/products/bulk/gst
 * Bulk set gst_percent on selected catalogue items for the merchant.
 */
async function bulkUpdateGst(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) return sendError(res, 'Only merchant users can update GST settings', 403);

    const { catalogueIds, gstPercent } = req.body;
    if (!catalogueIds || !catalogueIds.length) {
      return sendError(res, 'catalogueIds (array) is required', 400);
    }
    if (gstPercent === undefined || gstPercent === null || isNaN(Number(gstPercent))) {
      return sendError(res, 'gstPercent is required and must be a number', 400);
    }
    const pct = Math.max(0, Math.min(100, Number(gstPercent)));
    await productService.bulkUpdateGst(merchantId, catalogueIds, pct);
    return sendSuccess(res, `GST of ${pct}% applied to ${catalogueIds.length} product(s)`);
  } catch (err) {
    logger.error(MODULE, 'BULK_UPDATE_GST_ERROR', { error: err.message });
    return sendError(res, 'Failed to update GST', 500);
  }
}

/**
 * POST /api/products/bulk/delivery
 * Bulk set delivery_charge on selected catalogue items for the merchant.
 */
async function bulkUpdateDeliveryCharge(req, res) {
  try {
    const merchantId = req.selloUser.merchantId;
    if (!merchantId) return sendError(res, 'Only merchant users can update delivery charge settings', 403);

    const { catalogueIds, deliveryCharge } = req.body;
    if (!catalogueIds || !catalogueIds.length) {
      return sendError(res, 'catalogueIds (array) is required', 400);
    }
    if (deliveryCharge === undefined || deliveryCharge === null || isNaN(Number(deliveryCharge))) {
      return sendError(res, 'deliveryCharge is required and must be a number', 400);
    }
    const charge = Math.max(0, Number(deliveryCharge));
    await productService.bulkUpdateDeliveryCharge(merchantId, catalogueIds, charge);
    return sendSuccess(res, `Delivery charge of ₹${charge} applied to ${catalogueIds.length} product(s)`);
  } catch (err) {
    logger.error(MODULE, 'BULK_UPDATE_DELIVERY_ERROR', { error: err.message });
    return sendError(res, 'Failed to update delivery charge', 500);
  }
}

// ─── AI / Image / Misc Handlers ───────────────────────────────────────────────

/**
 * POST /api/products/upload
 * Handles product image uploads using multer.
 */
async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return sendError(res, 'No file uploaded', 400);
    }

    // Check if Cloudinary is configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      logger.info(MODULE, 'UPLOADING_TO_CLOUDINARY', { path: req.file.path });
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'sello_products'
      });

      // Cleanup local temp file
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        logger.error(MODULE, 'UNLINK_TEMP_FILE_ERROR', { error: unlinkErr.message });
      }

      return sendSuccess(res, 'Image uploaded successfully to Cloudinary', { imageUrl: result.secure_url });
    }

    // Fallback to local static serving
    const host     = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${host}/uploads/${req.file.filename}`;
    return sendSuccess(res, 'Image uploaded successfully (fallback to local server)', { imageUrl });
  } catch (err) {
    logger.error(MODULE, 'UPLOAD_IMAGE_ERROR', { error: err.message });
    // Attempt cleanup if local file exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    return sendError(res, 'Failed to upload image', 500);
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
 * GET /api/products/search-images?query=sandwich
 * Searches Pexels for 4 professional product images.
 */
async function searchImages(req, res) {
  try {
    const query = (req.query.query || '').trim();
    const category = (req.query.category || '').trim().toLowerCase();
    if (!query) return sendError(res, 'query parameter is required', 400);

    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) return sendError(res, 'Image search not configured', 500);

    // Build context-aware query for professional studio shots
    let suffix = ' product';
    
    const foodKeywords = ['food', 'beverage', 'drink', 'pizza', 'burger', 'sandwich', 'bakery', 'restaurant', 'cafe', 'dessert', 'sweet', 'juice'];
    const fashionKeywords = ['clothing', 'wear', 'apparel', 'fashion', 'shoes', 'shirt', 'jeans', 'pants', 'tshirt', 'dress', 'accessories'];
    const techKeywords = ['electronics', 'gadget', 'phone', 'laptop', 'tech', 'smart', 'watch', 'device'];

    if (foodKeywords.some(kw => category.includes(kw) || query.toLowerCase().includes(kw))) {
      suffix = ' food';
    } else if (fashionKeywords.some(kw => category.includes(kw) || query.toLowerCase().includes(kw))) {
      suffix = ' apparel';
    } else if (techKeywords.some(kw => category.includes(kw) || query.toLowerCase().includes(kw))) {
      suffix = ' product shot';
    }

    const searchQuery = encodeURIComponent(`${query}${suffix}`);
    const url         = `https://api.pexels.com/v1/search?query=${searchQuery}&per_page=4&orientation=square`;

    const response = await fetch(url, {
      headers: { Authorization: apiKey }
    });

    if (!response.ok) {
      logger.error(MODULE, 'PEXELS_API_ERROR', { status: response.status });
      return sendError(res, 'Image search failed', 500);
    }

    const data = await response.json();
    const images = (data.photos || []).map(photo => ({
      id: photo.id,
      url: photo.src.large,          // ~1200px — good quality
      thumb: photo.src.medium,       // ~350px — for grid preview
      photographer: photo.photographer,
      alt: photo.alt || query
    }));

    return sendSuccess(res, 'Images fetched', { images });
  } catch (err) {
    logger.error(MODULE, 'SEARCH_IMAGES_ERROR', { error: err.message });
    return sendError(res, 'Failed to search images', 500);
  }
}

/**
 * GET /api/products/suggestions
 */
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

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Master products
  getMasterProducts,
  createMasterProduct,
  updateMasterProduct,
  deleteMasterProduct,
  duplicateProduct,
  // Inherited / merchant products
  getInheritedProducts,
  delinkProduct,
  relinkProduct,
  createMerchantProduct,
  updateMerchantProduct,
  deleteMerchantProduct,
  // Catalogue / stock
  updateStockStatus,
  snoozeCatalogItems,
  unsnoozeCatalogItems,
  toggleTopSellingProducts,
  getCategorySnoozeStatus,
  // Order Settings bulk operations
  bulkUpdateDiscount,
  bulkUpdateGst,
  bulkUpdateDeliveryCharge,
  // AI / images / misc
  uploadImage,
  generateDescription,
  searchImages,
  getSearchSuggestions,
  swapProducts
};
