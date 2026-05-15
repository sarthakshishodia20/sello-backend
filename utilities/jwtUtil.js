const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET     = process.env.JWT_SECRET     || 'selo_default_secret';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Sign a JWT token for the given payload
 * @param {Object} payload  - Data to encode (e.g. { id, role, merchantId })
 * @returns {string}        - Signed JWT string
 */
function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

/**
 * Verify a JWT token
 * @param {string} token
 * @returns {Object|null}   - Decoded payload or null if invalid
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { signToken, verifyToken };
