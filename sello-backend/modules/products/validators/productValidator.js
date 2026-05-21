const Joi          = require('joi');
const { validate } = require('../../../utilities/validateUtil');

// ─── Schemas ─────────────────────────────────────────────────────────────────

const masterProductSchema = Joi.object({
  category_id:        Joi.number().integer().required(),
  sku:                Joi.string().min(2).max(100).required(),
  name:               Joi.string().min(1).max(180).required(),
  short_description:  Joi.string().max(255).allow('', null).optional(),
  description:        Joi.string().allow('', null).optional(),
  ai_description:     Joi.string().allow('', null).optional(),
  price:              Joi.number().min(0).required(),
  stock_qty:          Joi.number().integer().min(-1).optional(),
  image_url:          Joi.string().uri().allow('', null).optional(),
  sort_order:         Joi.number().integer().min(0).optional(),
  is_active:          Joi.boolean().optional()
});

const masterProductUpdateSchema = Joi.object({
  category_id:        Joi.number().integer().optional(),
  sku:                Joi.string().min(2).max(100).optional(),
  name:               Joi.string().min(1).max(180).optional(),
  short_description:  Joi.string().max(255).allow('', null).optional(),
  description:        Joi.string().allow('', null).optional(),
  ai_description:     Joi.string().allow('', null).optional(),
  price:              Joi.number().min(0).optional(),
  stock_qty:          Joi.number().integer().min(-1).optional(),
  image_url:          Joi.string().uri().allow('', null).optional(),
  sort_order:         Joi.number().integer().min(0).optional(),
  is_active:          Joi.boolean().optional()
}).min(1);

const merchantProductUpdateSchema = Joi.object({
  category_id:        Joi.number().integer().optional(),
  name:               Joi.string().min(1).max(180).optional(),
  short_description:  Joi.string().max(255).allow('', null).optional(),
  description:        Joi.string().allow('', null).optional(),
  ai_description:     Joi.string().allow('', null).optional(),
  price:              Joi.number().min(0).optional(),
  stock_qty:          Joi.number().integer().min(-1).optional(),
  image_url:          Joi.string().uri().allow('', null).optional(),
  is_active:          Joi.boolean().optional()
}).min(1);

const generateDescriptionSchema = Joi.object({
  product_name:  Joi.string().min(1).max(200).required(),
  category_name: Joi.string().allow('', null).optional()
});

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  validateCreateMasterProduct:   validate(masterProductSchema),
  validateUpdateMasterProduct:   validate(masterProductUpdateSchema),
  validateUpdateMerchantProduct: validate(merchantProductUpdateSchema),
  validateGenerateDescription:   validate(generateDescriptionSchema)
};
