const { sendForbidden } = require('../utilities/responseUtil');

/**
 * Small role helper used by Phase 1 routes.
 * The mini version supports a masterbrand admin and merchant admins.
 */
function allowRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.selloUser || !allowedRoles.includes(req.selloUser.role)) {
      return sendForbidden(res, 'You do not have permission to perform this action.');
    }
    return next();
  };
}

/**
 * Masterbrand-level routes are open to super admin and masterbrand admin users.
 */
const adminOnly = allowRoles('SUPER_ADMIN', 'MASTERBRAND_ADMIN');

/**
 * Merchant editing routes are limited to merchant admins.
 */
const merchantOnly = allowRoles('MERCHANT_ADMIN');

module.exports = { allowRoles, adminOnly, merchantOnly };
