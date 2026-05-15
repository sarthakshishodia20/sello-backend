/**
 * Sello — Standard API Response Utility
 * All API responses follow: { status: 0|1, message: string, data: any }
 */

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
  return res.status(404).json({
    status : STATUS.ERROR,
    message,
    data   : {}
  });
}

module.exports = { sendSuccess, sendError, sendUnauthorized, sendForbidden, sendNotFound };
