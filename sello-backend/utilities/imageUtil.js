/**
 * Sello — Shared Image URL Utility
 *
 * Centralises the two nearly-identical image-URL helpers that were duplicated
 * across productController.js and webappController.js.
 *
 * Usage:
 *   const { formatImageUrls, cleanImageUrl } = require('../../../utilities/imageUtil');
 *
 *   // Format stored relative paths to full absolute URLs:
 *   products = formatImageUrls(req, products, ['image_url', 'effective_image_url']);
 *
 *   // Strip the host prefix before persisting to DB:
 *   body.image_url = cleanImageUrl(body.image_url);
 */

/**
 * Converts /uploads/... relative paths to full absolute URLs using the
 * incoming request's protocol + host.  Accepts both a single object and an
 * array of objects.  The fields to format are configurable so the same helper
 * works for master products (4 image fields) and webapp stores (2 fields).
 *
 * @param {import('express').Request} req
 * @param {Object|Object[]} dataOrArray
 * @param {string[]} [fields] - image field names to rewrite (defaults cover all known fields)
 * @returns {Object|Object[]}
 */
function formatImageUrls(
  req,
  dataOrArray,
  fields = ['image_url', 'effective_image_url', 'master_image_url', 'merchant_image_url']
) {
  const host = `${req.protocol}://${req.get('host')}`;

  const formatUrl = (url) => {
    if (url) {
      if (url.startsWith('/uploads/')) {
        return `${host}${url}`;
      }
      if (url.startsWith('uploads/')) {
        return `${host}/${url}`;
      }
    }
    return url;
  };

  const formatItem = (item) => {
    if (!item) return item;
    const formatted = { ...item };
    for (const field of fields) {
      if (formatted[field] !== undefined) {
        formatted[field] = formatUrl(formatted[field]);
      }
    }
    return formatted;
  };

  if (Array.isArray(dataOrArray)) {
    return dataOrArray.map(formatItem);
  }
  return formatItem(dataOrArray);
}

/**
 * Strips the host prefix from a full image URL, keeping only the /uploads/...
 * relative path for storage.  Safe to call on already-clean paths or null.
 *
 * @param {string|null} url
 * @returns {string|null}
 */
function cleanImageUrl(url) {
  if (!url) return url;
  const match = url.match(/\/uploads\/[^/]+$/);
  return match ? match[0] : url;
}

module.exports = { formatImageUrls, cleanImageUrl };
