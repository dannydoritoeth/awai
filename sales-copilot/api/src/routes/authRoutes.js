const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Generic OAuth routes that will work for multiple integrations
router.get('/:integration/connect', authController.initiateOAuth);
router.get('/:integration/callback', authController.handleOAuthCallback);

module.exports = router; 