const Joi = require('joi');
const { sendError } = require('../../../utilities/responseUtil');

const ORDER_STATUSES = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

const placeOrderSchema = Joi.object({
  merchant_id: Joi.number().integer().required(),
  customer_id: Joi.number().integer().allow(null).optional(),
  customer_name: Joi.string().min(1).max(120).required(),
  customer_phone: Joi.string().min(5).max(30).required(),
  customer_email: Joi.string().email().allow('', null).optional(),
  customer_address: Joi.string().min(5).required(),
  notes: Joi.string().allow('', null).optional(),
  payment_method: Joi.string().valid('COD').optional(),
  items: Joi.array().items(
    Joi.object({
      catalogue_id: Joi.number().integer().required(),
      quantity: Joi.number().integer().min(1).required()
    })
  ).min(1).required()
});


const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...ORDER_STATUSES).required()
});

const billBreakdownSchema = Joi.object({
  merchant_id: Joi.number().integer().required(),
  items: Joi.array().items(
    Joi.object({
      catalogue_id: Joi.number().integer().required(),
      quantity: Joi.number().integer().min(1).required()
    })
  ).min(1).required()
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
  validatePlaceOrder: validate(placeOrderSchema),
  validateUpdateStatus: validate(updateStatusSchema),
  validateBillBreakdown: validate(billBreakdownSchema),
  ORDER_STATUSES
};

