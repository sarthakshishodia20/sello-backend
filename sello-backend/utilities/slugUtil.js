/**
 * Convert arbitrary text into a URL-safe slug.
 * The helper is reused across merchants and categories to keep naming predictable.
 */
function toSlug(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Convert text into an uppercase code token suitable for merchant/store codes.
 */
function toCode(value = '') {
  return toSlug(value)
    .replace(/-/g, '_')
    .toUpperCase()
    .slice(0, 50);
}

module.exports = { toSlug, toCode };
