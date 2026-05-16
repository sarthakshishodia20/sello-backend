const express = require('express');
const router = express.Router();
const controller = require('./controllers/notificationController');
const { authenticate } = require('../../middlewares/auth');

router.get('/templates', authenticate, controller.getTemplates);
router.post('/templates', authenticate, controller.createTemplate);
router.put('/templates/:id', authenticate, controller.updateTemplate);

router.get('/history', authenticate, controller.getHistory);

module.exports = router;
