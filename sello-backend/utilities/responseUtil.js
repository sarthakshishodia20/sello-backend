/**
 * Sello — Standard API Response Utility
 * All API responses follow: { status: 0|1, message: string, data: any }
 */

const { trackError } = require('./errorTracker');

const STATUS = {
  SUCCESS: 1,
  ERROR  : 0
};

/**
 * Send a success response
 */
function sendSuccess(res, message = 'Success', data = {}, statusCode = 200) {
  return res.status(statusCode).json({
    status : STATUS.SUCCESS,
    message,
    data
  });
}

/**
 * Send an error response
 */
function sendError(res, message = 'Something went wrong', statusCode = 400, data = {}) {
  // Track this error automatically in tb_errors table!
  trackError(message, res.req);

  return res.status(statusCode).json({
    status : STATUS.ERROR,
    message,
    data
  });
}

/**
 * Send a 401 Unauthorized response
 */
function sendUnauthorized(res, message = 'Unauthorized') {
  // Track this error automatically in tb_errors table!
  trackError(`Unauthorized: ${message}`, res.req);

  return res.status(401).json({
    status : STATUS.ERROR,
    message,
    data   : {}
  });
}

/**
 * Send a 403 Forbidden response
 */
function sendForbidden(res, message = 'Access denied') {
  // Track this error automatically in tb_errors table!
  trackError(`Forbidden: ${message}`, res.req);

  return res.status(403).json({
    status : STATUS.ERROR,
    message,
    data   : {}
  });
}

/**
 * Send a 404 Not Found response
 */
function sendNotFound(res, message = 'Resource not found') {
  // Track this error automatically in tb_errors table!
  trackError(`NotFound: ${message}`, res.req);

  return res.status(404).json({
    status : STATUS.ERROR,
    message,
    data   : {}
  });
}

module.exports = { sendSuccess, sendError, sendUnauthorized, sendForbidden, sendNotFound };
