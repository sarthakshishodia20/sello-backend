/**
 * Sello — Shared Joi Validation Utility
 *
 * Single source of truth for the Joi middleware wrapper used by every module's
 * validator file. Prevents copy-paste drift between modules.
 */

const { sendError } = require('./responseUtil');

/**
 * Returns an Express middleware that validates req.body against the given Joi schema.
 * On failure, responds with a 400 and a joined error message.
 *
 * @param {import('joi').Schema} schema
 * @returns {import('express').RequestHandler}
 */
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      convert: true,
      stripUnknown: true
    });

    if (error) {
      return sendError(res, error.details.map((d) => d.message).join(', '));
    }

    return next();
  };
}

module.exports = { validate };
