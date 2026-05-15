const router     = require('express').Router();
const controller = require('./controllers/webappController');

// All public — no auth required
router.get('/stores',                        controller.getAllStores);
router.get('/stores/:slug',                  controller.getStoreBySlug);
router.get('/stores/:slug/categories',       controller.getCategoriesForStore);
router.get('/stores/:slug/products',         controller.getProductsForStore);

module.exports = router;
