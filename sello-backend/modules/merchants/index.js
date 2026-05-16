const router     = require('express').Router();
const controller = require('./controllers/merchantController');
const { authenticate } = require('../../middlewares/auth');
const { adminOnly }    = require('../../middlewares/roleGuard');

router.use(authenticate);

router.get('/overview', controller.getOverview);
router.get('/notifications', controller.getNotifications);
router.put('/notifications/:id/snooze', controller.snoozeNotification);
router.put('/notifications/:id/read', controller.markNotificationRead);
router.get('/', adminOnly, controller.getAllMerchants);
router.get('/profile', controller.getMerchantProfile);
router.put('/profile', controller.updateMerchantProfile);
router.get('/settings', controller.getSettings);
router.put('/settings', adminOnly, controller.updateSettings);
router.get('/:id', adminOnly, controller.getMerchantProfile);
router.post('/', adminOnly, controller.createMerchant);
router.put('/:id/status', adminOnly, controller.toggleMerchantStatus);
router.delete('/:id', adminOnly, controller.deleteMerchant);



module.exports = router;
