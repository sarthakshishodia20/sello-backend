const webappService = require('../services/webappService');
const { sendSuccess, sendError, sendNotFound } = require('../../../utilities/responseUtil');
const logger = require('../../../utilities/loggingUtil');

const MODULE = 'WebappController';

async function getAllStores(req, res) {
  try {
    const stores = await webappService.getAllActiveStores();
    return sendSuccess(res, 'Stores fetched', { stores, total: stores.length });
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
    return sendSuccess(res, 'Store fetched', {
      store,
      categories: categoryResult.categories,
      category_tree: categoryResult.tree
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
      tree: result.tree
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
      search: req.query.search || '',
      limit: req.query.limit ? Number(req.query.limit) : 12,
      offset: req.query.offset ? Number(req.query.offset) : 0
    });

    return sendSuccess(res, 'Products fetched', { products, total });
  } catch (err) {
    logger.error(MODULE, 'GET_PRODUCTS_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch products', 500);
  }
}

module.exports = { getAllStores, getStoreBySlug, getCategoriesForStore, getProductsForStore };
