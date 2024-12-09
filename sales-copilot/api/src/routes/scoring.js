const express = require('express');
const router = express.Router();
const scoringService = require('../services/scoringService');
const logger = require('../services/logger');

// Calculate score for a single entity
router.post('/', async (req, res, next) => {
    try {
        const { customerId, entityType, data } = req.body;

        if (!customerId || !entityType || !data) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Missing required fields: customerId, entityType, data'
            });
        }

        if (!['contact', 'prospective_buyer', 'enquiry'].includes(entityType)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'entityType must be either "contact", "prospective_buyer", or "enquiry"'
            });
        }

        const result = await scoringService.calculateScore(customerId, entityType, data);
        res.json(result);
    } catch (error) {
        logger.error('Error calculating score:', error);
        next(error);
    }
});

// Get score for a specific entity
router.get('/:customerId/:entityId', async (req, res, next) => {
    try {
        const { customerId, entityId } = req.params;
        const { entityType } = req.query;

        if (!entityType) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'entityType query parameter is required'
            });
        }

        if (!['contact', 'prospective_buyer', 'enquiry'].includes(entityType)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'entityType must be either "contact", "prospective_buyer", or "enquiry"'
            });
        }

        const score = await scoringService.getScore(customerId, entityId, entityType);
        
        if (!score) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Score not found'
            });
        }

        res.json(score);
    } catch (error) {
        logger.error('Error retrieving score:', error);
        next(error);
    }
});

// Get all scores for a customer
router.get('/:customerId', async (req, res, next) => {
    try {
        const { customerId } = req.params;
        const { entityType } = req.query;

        if (entityType && !['contact', 'prospective_buyer', 'enquiry'].includes(entityType)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'entityType must be either "contact", "prospective_buyer", or "enquiry"'
            });
        }

        const scores = await scoringService.getCustomerScores(customerId, entityType);
        res.json(scores);
    } catch (error) {
        logger.error('Error retrieving customer scores:', error);
        next(error);
    }
});

// Batch score calculation
router.post('/batch', async (req, res, next) => {
    try {
        const { customerId, entities } = req.body;

        if (!customerId || !Array.isArray(entities)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Missing required fields: customerId, entities (array)'
            });
        }

        const invalidEntity = entities.find(e => 
            !['contact', 'prospective_buyer', 'enquiry'].includes(e.entityType)
        );

        if (invalidEntity) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'All entities must be either "contact", "prospective_buyer", or "enquiry"'
            });
        }

        const results = await Promise.all(
            entities.map(async ({ entityType, data }) => {
                try {
                    return await scoringService.calculateScore(customerId, entityType, data);
                } catch (error) {
                    return {
                        error: error.message,
                        entityId: data.id,
                        entityType
                    };
                }
            })
        );

        res.json(results);
    } catch (error) {
        logger.error('Error in batch scoring:', error);
        next(error);
    }
});

module.exports = router; 