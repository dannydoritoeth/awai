const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

router.post('/query', searchController.query);

module.exports = router; 