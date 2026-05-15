const db = require('../../../database/mysqlLib');
const logger = require('../../../utilities/loggingUtil');
const { toSlug } = require('../../../utilities/slugUtil');

const MODULE = 'CatalogService';

/**
 * Tree builder is shared by dashboard pages and webapp filters.
 */
function buildCategoryTree(categories) {
  const map = new Map();
  const roots = [];

  categories.forEach((category) => {
    map.set(category.id, { ...category, children: [] });
  });

  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortTree = (nodes) => {
    nodes.sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => sortTree(node.children));
  };

  sortTree(roots);
  return roots;
}

/**
 * Returns flat and nested representations of the masterbrand category tree.
 */
async function getCategoriesByMasterbrand(masterbrandId, { includeInactive = true } = {}) {
  const params = [masterbrandId];
  let whereSql = 'WHERE c.masterbrand_id = ? AND c.is_deleted = 0';

  if (!includeInactive) {
    whereSql += ' AND c.is_active = 1';
  }

  const categories = await db.query(`
    SELECT
      c.id,
      c.masterbrand_id,
      c.parent_id,
      c.name,
      c.slug,
      c.description,
      c.sort_order,
      c.is_active,
      c.created_at,
      parent.name AS parent_name
    FROM tb_categories c
    LEFT JOIN tb_categories parent ON parent.id = c.parent_id
    ${whereSql}
    ORDER BY c.sort_order ASC, c.created_at ASC
  `, params);

  return { categories, tree: buildCategoryTree(categories) };
}

/**
 * ID lookup scoped to a masterbrand, protecting admin actions from accidental cross-tenant edits.
 */
async function getCategoryById(categoryId, masterbrandId) {
  const rows = await db.query(
    `SELECT * FROM tb_categories
     WHERE id = ? AND masterbrand_id = ?
     LIMIT 1`,
    [categoryId, masterbrandId]
  );

  return rows[0] || null;
}

/**
 * Slugs are derived from the category name and uniquified inside the same parent scope.
 */
async function buildUniqueCategorySlug(masterbrandId, parentId, name, categoryId = null) {
  const baseSlug = toSlug(name) || 'category';
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const rows = await db.query(
      `SELECT id
       FROM tb_categories
       WHERE masterbrand_id = ?
         AND is_deleted = 0
         AND ((parent_id IS NULL AND ? IS NULL) OR parent_id = ?)
         AND slug = ?
         AND (? IS NULL OR id <> ?)
       LIMIT 1`,
      [masterbrandId, parentId, parentId, candidate, categoryId, categoryId]
    );

    if (!rows.length) {
      return candidate;
    }

    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

/**
 * Creates a root category or subcategory under the masterbrand.
 */
async function createCategory(masterbrandId, { parent_id, name, description, sort_order, is_active }) {
  const slug = await buildUniqueCategorySlug(masterbrandId, parent_id || null, name);
  const result = await db.query(
    `INSERT INTO tb_categories
      (masterbrand_id, parent_id, name, slug, description, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      masterbrandId,
      parent_id || null,
      name,
      slug,
      description || null,
      sort_order ?? 0,
      is_active === undefined ? 1 : Number(Boolean(is_active))
    ]
  );

  logger.info(MODULE, 'CATEGORY_CREATED', { categoryId: result.insertId, name, masterbrandId });
  return { id: result.insertId };
}

/**
 * Updates the category while preserving slug uniqueness rules.
 */
async function updateCategory(categoryId, masterbrandId, fields) {
  const existing = await getCategoryById(categoryId, masterbrandId);
  if (!existing) {
    return false;
  }

  const nextParentId = fields.parent_id === undefined ? existing.parent_id : (fields.parent_id || null);
  const nextName = fields.name === undefined ? existing.name : fields.name;
  const nextSlug = await buildUniqueCategorySlug(masterbrandId, nextParentId, nextName, categoryId);

  const updates = [];
  const params = [];

  if (fields.parent_id !== undefined) {
    updates.push('parent_id = ?');
    params.push(nextParentId);
  }
  if (fields.name !== undefined) {
    updates.push('name = ?');
    params.push(fields.name);
    updates.push('slug = ?');
    params.push(nextSlug);
  }
  if (fields.description !== undefined) {
    updates.push('description = ?');
    params.push(fields.description || null);
  }
  if (fields.sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(fields.sort_order);
  }
  if (fields.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(Number(Boolean(fields.is_active)));
  }

  if (!updates.length) {
    return true;
  }

  params.push(categoryId, masterbrandId);
  await db.query(
    `UPDATE tb_categories SET ${updates.join(', ')} WHERE id = ? AND masterbrand_id = ?`,
    params
  );

  logger.info(MODULE, 'CATEGORY_UPDATED', { categoryId, masterbrandId });
  return true;
}

/**
 * Marks a category as deleted. Also marks all its products as deleted.
 */
async function archiveCategory(categoryId, masterbrandId) {
  return db.transaction(async (query) => {
    // Mark category deleted
    await query(
      'UPDATE tb_categories SET is_deleted = 1, is_active = 0 WHERE id = ? AND masterbrand_id = ?',
      [categoryId, masterbrandId]
    );

    // Mark all products in this category as deleted
    await query(
      'UPDATE tb_products SET is_deleted = 1, is_active = 0 WHERE category_id = ? AND masterbrand_id = ?',
      [categoryId, masterbrandId]
    );

    logger.info(MODULE, 'CATEGORY_AND_PRODUCTS_SOFT_DELETED', { categoryId, masterbrandId });
  });
}

/**
 * Exchanges sort_order values between two categories to support drag-and-drop.
 */
async function swapCategories(masterbrandId, id1, id2) {
  return db.transaction(async (query) => {
    const rows = await query(
      'SELECT id, sort_order FROM tb_categories WHERE id IN (?, ?) AND masterbrand_id = ?',
      [id1, id2, masterbrandId]
    );

    if (rows.length !== 2) {
      throw new Error('Both categories must exist and belong to the same masterbrand');
    }

    const c1 = rows.find(r => r.id === Number(id1));
    const c2 = rows.find(r => r.id === Number(id2));

    await query('UPDATE tb_categories SET sort_order = ? WHERE id = ?', [c2.sort_order, c1.id]);
    await query('UPDATE tb_categories SET sort_order = ? WHERE id = ?', [c1.sort_order, c2.id]);

    logger.info(MODULE, 'CATEGORIES_SWAPPED', { id1, id2, masterbrandId });
  });
}

module.exports = {
  buildCategoryTree,
  getCategoriesByMasterbrand,
  getCategoryById,
  createCategory,
  updateCategory,
  archiveCategory,
  swapCategories
};
