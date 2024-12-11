const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('../services/logger');
const scoringRoutes = require('./routes/scoring');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/v1/scores', scoringRoutes);

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    logger.error('API Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
};

app.use(errorHandler);

module.exports = app; 