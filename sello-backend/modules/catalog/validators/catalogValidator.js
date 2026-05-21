const Joi          = require('joi');
const { validate } = require('../../../utilities/validateUtil');

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createCategorySchema = Joi.object({
  parent_id:   Joi.number().integer().allow(null).optional(),
  name:        Joi.string().min(1).max(150).required(),
  description: Joi.string().allow('', null).optional(),
  sort_order:  Joi.number().integer().min(0).optional(),
  is_active:   Joi.boolean().optional()
});

const updateCategorySchema = Joi.object({
  parent_id:   Joi.number().integer().allow(null).optional(),
  name:        Joi.string().min(1).max(150).optional(),
  description: Joi.string().allow('', null).optional(),
  sort_order:  Joi.number().integer().min(0).optional(),
  is_active:   Joi.boolean().optional()
}).min(1);

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  validateCreate: validate(createCategorySchema),
  validateUpdate: validate(updateCategorySchema)
};
