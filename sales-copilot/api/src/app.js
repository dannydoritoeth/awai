const express = require('express');
const cors = require('cors');
const webhookRoutes = require('./routes/webhookRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/webhooks', webhookRoutes);
app.use('/auth', authRoutes);

module.exports = app; 