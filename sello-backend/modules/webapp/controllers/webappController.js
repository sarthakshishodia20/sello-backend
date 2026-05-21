const webappService                           = require('../services/webappService');
const { sendSuccess, sendError, sendNotFound } = require('../../../utilities/responseUtil');
const { formatImageUrls }                      = require('../../../utilities/imageUtil');
const logger                                   = require('../../../utilities/loggingUtil');

const MODULE = 'WebappController';

// ─── Store Handlers ───────────────────────────────────────────────────────────

async function getAllStores(req, res) {
  try {
    const { search, city, mode, limit = 12, offset = 0 } = req.query;
    const stores   = await webappService.getAllActiveStores(search, city, mode, limit, offset);
    const settings = await webappService.getMasterbrandSettings();

    return sendSuccess(res, 'Stores fetched', {
      stores:   formatImageUrls(req, stores),
      total:    stores.length,
      settings
    });
  } catch (err) {
    logger.error(MODULE, 'GET_ALL_STORES_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch stores', 500);
  }
}

/**
 * Store detail includes category filters so the webapp can render in one round trip.
 */
async function getStoreBySlug(req, res) {
  try {
    const store = await webappService.getStoreBySlug(req.params.slug);
    if (!store) {
      return sendNotFound(res, 'Store not found');
    }

    const categoryResult = await webappService.getCategoriesForStore(store.masterbrand_id);
    const settings       = await webappService.getMasterbrandSettings(store.masterbrand_id);

    return sendSuccess(res, 'Store fetched', {
      store:         formatImageUrls(req, store),
      categories:    categoryResult.categories,
      category_tree: categoryResult.tree,
      settings
    });
  } catch (err) {
    logger.error(MODULE, 'GET_STORE_BY_SLUG_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch store', 500);
  }
}

async function getCategoriesForStore(req, res) {
  try {
    const store = await webappService.getStoreBySlug(req.params.slug);
    if (!store) {
      return sendNotFound(res, 'Store not found');
    }

    const result = await webappService.getCategoriesForStore(store.masterbrand_id);
    return sendSuccess(res, 'Categories fetched', {
      categories: result.categories,
      tree:       result.tree
    });
  } catch (err) {
    logger.error(MODULE, 'GET_CATEGORIES_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch categories', 500);
  }
}

async function getProductsForStore(req, res) {
  try {
    const store = await webappService.getStoreBySlug(req.params.slug);
    if (!store) {
      return sendNotFound(res, 'Store not found');
    }

    const { products, total } = await webappService.getProductsForStore(store.id, {
      categoryId: req.query.category_id ? Number(req.query.category_id) : null,
      search:     req.query.search || '',
      limit:      req.query.limit  ? Number(req.query.limit)  : 12,
      offset:     req.query.offset ? Number(req.query.offset) : 0
    });

    return sendSuccess(res, 'Products fetched', {
      products: formatImageUrls(req, products),
      total
    });
  } catch (err) {
    logger.error(MODULE, 'GET_PRODUCTS_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch products', 500);
  }
}

// ─── Wishlist Handlers ────────────────────────────────────────────────────────

async function getWishlistItems(req, res) {
  try {
    const { storeIds = [], productIds = [] } = req.body;
    const result = await webappService.getWishlistItems(storeIds, productIds);
    if (result.stores)   result.stores   = formatImageUrls(req, result.stores);
    if (result.products) result.products = formatImageUrls(req, result.products);
    return sendSuccess(res, 'Wishlist fetched', result);
  } catch (err) {
    logger.error(MODULE, 'GET_WISHLIST_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch wishlist', 500);
  }
}

async function toggleWishlist(req, res) {
  try {
    const { type, itemId } = req.body;
    const customerId       = req.selloUser.id;
    const result           = await webappService.toggleWishlist(customerId, type, itemId);
    return sendSuccess(res, result.added ? 'Added to wishlist' : 'Removed from wishlist', result);
  } catch (err) {
    logger.error(MODULE, 'TOGGLE_WISHLIST_ERROR', { error: err.message });
    return sendError(res, 'Failed to toggle wishlist', 500);
  }
}

async function getCustomerWishlist(req, res) {
  try {
    const customerId = req.selloUser.id;
    const result     = await webappService.getCustomerWishlist(customerId);
    if (result.stores)   result.stores   = formatImageUrls(req, result.stores);
    if (result.products) result.products = formatImageUrls(req, result.products);
    return sendSuccess(res, 'Customer wishlist fetched', result);
  } catch (err) {
    logger.error(MODULE, 'GET_CUSTOMER_WISHLIST_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch wishlist', 500);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getAllStores,
  getStoreBySlug,
  getCategoriesForStore,
  getProductsForStore,
  getWishlistItems,
  toggleWishlist,
  getCustomerWishlist
};
