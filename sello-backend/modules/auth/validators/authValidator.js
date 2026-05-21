const Joi           = require('joi');
const { validate }  = require('../../../utilities/validateUtil');

// ─── Schemas ────────────────────────────────────────────────────────────────

const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const merchantSignupSchema = Joi.object({
  owner_name:    Joi.string().min(2).max(120).required(),
  merchant_name: Joi.string().min(2).max(160).required(),
  email:         Joi.string().email().required(),
  password:      Joi.string().min(6).required(),
  phone:         Joi.string().max(30).allow('', null).optional(),
  address:       Joi.string().allow('', null).optional()
});

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  validateAdminLogin:    validate(loginSchema),
  validateMerchantLogin: validate(loginSchema),
  validateMerchantSignup: validate(merchantSignupSchema)
};
