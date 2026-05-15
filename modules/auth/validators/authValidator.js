const Joi = require('joi');
const { sendError } = require('../../../utilities/responseUtil');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const merchantSignupSchema = Joi.object({
  owner_name: Joi.string().min(2).max(120).required(),
  merchant_name: Joi.string().min(2).max(160).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string().max(30).allow('', null).optional(),
  address: Joi.string().allow('', null).optional()
});

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      convert: true,
      stripUnknown: true
    });

    if (error) {
      return sendError(res, error.details.map((detail) => detail.message).join(', '));
    }

    return next();
  };
}

module.exports = {
  validateAdminLogin: validate(loginSchema),
  validateMerchantLogin: validate(loginSchema),
  validateMerchantSignup: validate(merchantSignupSchema)
};
