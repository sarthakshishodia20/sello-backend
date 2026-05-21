const router     = require('express').Router();
const controller = require('./controllers/authController');
const validator  = require('./validators/authValidator');
const { authenticate } = require('../../middlewares/auth');

// Public routes
router.post('/admin/login',    validator.validateAdminLogin,    controller.adminLogin);
router.post('/admin/signup',   controller.adminSignup);
router.post('/merchant/login', validator.validateMerchantLogin, controller.merchantLogin);
router.post('/merchant/signup', validator.validateMerchantSignup, controller.merchantSignup);
router.post('/customer/signup', controller.customerSignup);
router.post('/customer/login',  controller.customerLogin);
router.get('/masterbrands',     controller.getMasterbrands);

// Protected routes
router.get('/profile', authenticate, controller.getProfile);
router.put('/profile', authenticate, controller.updateProfile);
router.put('/profile/theme', authenticate, controller.updateThemePreference);
router.get('/customers',    authenticate, controller.getCustomers);
router.put('/customers/:id', authenticate, controller.updateCustomer);
router.delete('/customers/:id', authenticate, controller.deleteCustomer);

module.exports = router;
