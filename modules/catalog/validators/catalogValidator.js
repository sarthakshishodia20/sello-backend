const Joi = require('joi');
const { sendError } = require('../../../utilities/responseUtil');

const createCategorySchema = Joi.object({
  parent_id: Joi.number().integer().allow(null).optional(),
  name: Joi.string().min(1).max(150).required(),
  description: Joi.string().allow('', null).optional(),
  sort_order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional()
});

const updateCategorySchema = Joi.object({
  parent_id: Joi.number().integer().allow(null).optional(),
  name: Joi.string().min(1).max(150).optional(),
  description: Joi.string().allow('', null).optional(),
  sort_order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional()
}).min(1);

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
  validateCreate: validate(createCategorySchema),
  validateUpdate: validate(updateCategorySchema)
};
