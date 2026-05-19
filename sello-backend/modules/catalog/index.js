const router     = require('express').Router();
const controller = require('./controllers/catalogController');
const validator  = require('./validators/catalogValidator');
const { authenticate } = require('../../middlewares/auth');
const { adminOnly, merchantOnly, allowRoles } = require('../../middlewares/roleGuard');

// All catalog routes require auth
router.use(authenticate);

router.get('/categories', controller.getCategories);
router.post('/categories/generate-description', adminOnly, controller.generateCategoryDescription);
router.post('/categories', adminOnly, validator.validateCreate, controller.createCategory);
router.put('/categories/:id', adminOnly, validator.validateUpdate, controller.updateCategory);
router.delete('/categories/:id', adminOnly, controller.deleteCategory);
router.post('/categories/swap', allowRoles('MASTERBRAND_ADMIN', 'MERCHANT_ADMIN'), controller.swapCategories);

module.exports = router;
