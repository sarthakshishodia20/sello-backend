const express = require('express');
const router = express.Router();
const controller = require('./controllers/activityController');
const { authenticate } = require('../../middlewares/auth');

router.get('/admin', authenticate, controller.getAdminActivity);
router.get('/merchant', authenticate, controller.getMerchantActivity);

module.exports = router;
