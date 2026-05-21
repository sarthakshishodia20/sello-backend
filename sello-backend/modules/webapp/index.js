const router     = require('express').Router();
const controller = require('./controllers/webappController');
const { authenticate } = require('../../middlewares/auth');

// All public — no auth required
router.get('/stores',                        controller.getAllStores);
router.get('/stores/:slug',                  controller.getStoreBySlug);
router.get('/stores/:slug/categories',       controller.getCategoriesForStore);
router.get('/stores/:slug/products',         controller.getProductsForStore);
router.get('/stores/:slug/top-selling',      controller.getTopSellingProducts);
router.post('/wishlist/bulk',                controller.getWishlistItems);

// Authenticated customer wishlist
router.get('/wishlist',        authenticate, controller.getCustomerWishlist);
router.post('/wishlist/toggle', authenticate, controller.toggleWishlist);

module.exports = router;


