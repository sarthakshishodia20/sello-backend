const { verifyToken }   = require('../utilities/jwtUtil');
const { sendUnauthorized } = require('../utilities/responseUtil');

/**
 * Middleware: authenticate any logged-in user (admin or merchant)
 * Attaches decoded token to req.selloUser
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'Authorization token missing');
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return sendUnauthorized(res, 'Invalid or expired token');
  }

  req.selloUser = decoded; // { id, name, email, role, merchantId }
  return next();
}

module.exports = { authenticate };
