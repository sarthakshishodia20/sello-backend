const router     = require('express').Router();
const controller = require('./controllers/productController');
const validator  = require('./validators/productValidator');
const { authenticate } = require('../../middlewares/auth');
const { adminOnly, merchantOnly, allowRoles } = require('../../middlewares/roleGuard');
const { upload } = require('../../middlewares/uploadMiddleware');

router.use(authenticate);

router.post('/upload', allowRoles('SUPER_ADMIN', 'MASTERBRAND_ADMIN', 'MERCHANT_ADMIN'), upload.single('image'), controller.uploadImage);
router.get('/suggestions', controller.getSearchSuggestions);

router.get('/master', adminOnly, controller.getMasterProducts);
router.post('/master', adminOnly, validator.validateCreateMasterProduct, controller.createMasterProduct);
router.put('/master/:id', adminOnly, validator.validateUpdateMasterProduct, controller.updateMasterProduct);
router.delete('/master/:id', adminOnly, controller.deleteMasterProduct);
router.post('/master/:id/duplicate', allowRoles('MASTERBRAND_ADMIN', 'MERCHANT_ADMIN'), controller.duplicateProduct);

router.get('/inherited', allowRoles('SUPER_ADMIN', 'MASTERBRAND_ADMIN', 'MERCHANT_ADMIN'), controller.getInheritedProducts);
router.delete('/merchant/:id', merchantOnly, controller.deleteMerchantProduct);
router.post('/inherited/:catalogueId/delink', merchantOnly, controller.delinkProduct);
router.post('/inherited/:catalogueId/relink', merchantOnly, controller.relinkProduct);
router.post('/merchant', merchantOnly, controller.createMerchantProduct);
router.put('/merchant/:id', merchantOnly, validator.validateUpdateMerchantProduct, controller.updateMerchantProduct);
router.put('/inherited/:catalogueId/stock-status', merchantOnly, controller.updateStockStatus);
router.post('/snooze', merchantOnly, controller.snoozeCatalogItems);
router.post('/unsnooze', merchantOnly, controller.unsnoozeCatalogItems);

router.post('/generate-description', validator.validateGenerateDescription, controller.generateDescription);
router.post('/swap', allowRoles('MASTERBRAND_ADMIN', 'MERCHANT_ADMIN'), controller.swapProducts);

module.exports = router;
