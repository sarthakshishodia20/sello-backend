const router     = require('express').Router();
const controller = require('./controllers/orderController');
const validator  = require('./validators/orderValidator');
const { authenticate } = require('../../middlewares/auth');
const { allowRoles } = require('../../middlewares/roleGuard');

// Customer routes
router.get('/customer/my-orders', authenticate, controller.getCustomerOrders);
router.put('/customer/:id/cancel', authenticate, controller.cancelOrder);

// Public route — place order from webapp
router.post('/bill-breakdown', validator.validateBillBreakdown, controller.getBillBreakdown);
router.post('/place', validator.validatePlaceOrder, controller.placeOrder);


// Protected routes — dashboard
router.get('/analytics', authenticate, controller.getOrderAnalytics);
router.get('/stats',   authenticate, controller.getOrderStats);
router.get('/',        authenticate, controller.getOrders);
router.get('/:id',     authenticate, controller.getOrderById);

router.put(
  '/:id/status',
  authenticate,
  allowRoles('SUPER_ADMIN', 'MASTERBRAND_ADMIN', 'MERCHANT_ADMIN'),
  validator.validateUpdateStatus,
  controller.updateOrderStatus
);

router.delete(
  '/',
  authenticate,
  allowRoles('SUPER_ADMIN', 'MASTERBRAND_ADMIN'),
  controller.deleteOrders
);

module.exports = router;
