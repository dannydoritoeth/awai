const express = require('express');
const cors = require('cors');
const searchRoutes = require('./routes/searchRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/search', searchRoutes);

// Basic health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

module.exports = app; 