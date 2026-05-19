const catalogService = require('../services/catalogService');
const productService = require('../../products/services/productService');
const { sendSuccess, sendError, sendNotFound } = require('../../../utilities/responseUtil');
const logger = require('../../../utilities/loggingUtil');

const MODULE = 'CatalogController';

/**
 * GET /api/catalog/categories
 * Admin and merchant users can both read the masterbrand category tree.
 */
async function getCategories(req, res) {
  try {
    const includeInactive = String(req.query.include_inactive || 'true') === 'true';
    const result = await catalogService.getCategoriesByMasterbrand(req.selloUser.masterbrandId, {
      includeInactive
    });

    return sendSuccess(res, 'Categories fetched', {
      categories: result.categories,
      tree: result.tree,
      total: result.categories.length
    });
  } catch (err) {
    logger.error(MODULE, 'GET_CATEGORIES_ERROR', { error: err.message });
    return sendError(res, 'Failed to fetch categories', 500);
  }
}

/**
 * POST /api/catalog/categories
 * Root and subcategory creation stays masterbrand controlled in Phase 1.
 */
async function createCategory(req, res) {
  try {
    const { id } = await catalogService.createCategory(req.selloUser.masterbrandId, req.body);
    const category = await catalogService.getCategoryById(id, req.selloUser.masterbrandId);
    return sendSuccess(res, 'Category created successfully', { category }, 201);
  } catch (err) {
    logger.error(MODULE, 'CREATE_CATEGORY_ERROR', { error: err.message });
    return sendError(res, 'Failed to create category', 500);
  }
}

/**
 * PUT /api/catalog/categories/:id
 * Update category metadata and hierarchy.
 */
async function updateCategory(req, res) {
  try {
    const categoryId = Number(req.params.id);
    const existing = await catalogService.getCategoryById(categoryId, req.selloUser.masterbrandId);

    if (!existing) {
      return sendNotFound(res, 'Category not found');
    }

    await catalogService.updateCategory(categoryId, req.selloUser.masterbrandId, req.body);
    const category = await catalogService.getCategoryById(categoryId, req.selloUser.masterbrandId);
    return sendSuccess(res, 'Category updated successfully', { category });
  } catch (err) {
    logger.error(MODULE, 'UPDATE_CATEGORY_ERROR', { error: err.message });
    return sendError(res, 'Failed to update category', 500);
  }
}

/**
 * DELETE /api/catalog/categories/:id
 * Soft delete keeps the product history understandable.
 */
async function deleteCategory(req, res) {
  try {
    const categoryId = Number(req.params.id);
    const existing = await catalogService.getCategoryById(categoryId, req.selloUser.masterbrandId);

    if (!existing) {
      return sendNotFound(res, 'Category not found');
    }

    await catalogService.archiveCategory(categoryId, req.selloUser.masterbrandId);
    return sendSuccess(res, 'Category deleted successfully');
  } catch (err) {
    logger.error(MODULE, 'DELETE_CATEGORY_ERROR', { error: err.message });
    return sendError(res, 'Failed to delete category', 500);
  }
}

/**
 * POST /api/catalog/categories/swap
 * Exchanges sort_order between two categories.
 */
async function swapCategories(req, res) {
  try {
    const { id1, id2 } = req.body;
    if (!id1 || !id2) return sendError(res, 'Both id1 and id2 are required');

    await catalogService.swapCategories(req.selloUser.masterbrandId, id1, id2);
    return sendSuccess(res, 'Categories swapped successfully');
  } catch (err) {
    logger.error(MODULE, 'SWAP_CATEGORIES_ERROR', { error: err.message });
    return sendError(res, err.message);
  }
}

/**
 * POST /api/catalog/categories/generate-description
 * Uses Gemini AI to generate a description for a category.
 */
async function generateCategoryDescription(req, res) {
  try {
    const { category_name } = req.body;
    if (!category_name) return sendError(res, 'category_name is required', 400);
    // Reuse the same Gemini function from productService
    const description = await productService.generateAiDescription(category_name, 'Category');
    return sendSuccess(res, 'Description generated', { description });
  } catch (err) {
    logger.error(MODULE, 'GENERATE_CATEGORY_DESCRIPTION_ERROR', { error: err.message });
    return sendError(res, 'Failed to generate description', 500);
  }
}

module.exports = { getCategories, createCategory, updateCategory, deleteCategory, swapCategories, generateCategoryDescription };
