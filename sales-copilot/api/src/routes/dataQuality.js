const express = require('express');
const router = express.Router();
const dataQualityService = require('../services/dataQualityService');
const logger = require('../services/logger');

// Analyze quality for a single entity
router.post('/analyze', async (req, res, next) => {
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

        const report = await dataQualityService.analyzeQuality(entityType, data);
        await dataQualityService.storeQualityReport(customerId, report);
        
        res.json(report);
    } catch (error) {
        logger.error('Error analyzing data quality:', error);
        next(error);
    }
});

// Get quality report for a specific entity
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

        const report = await dataQualityService.getQualityReport(customerId, entityId, entityType);
        
        if (!report) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Quality report not found'
            });
        }

        res.json(report);
    } catch (error) {
        logger.error('Error retrieving quality report:', error);
        next(error);
    }
});

// Get all quality reports for a customer
router.get('/:customerId', async (req, res, next) => {
    try {
        const { customerId } = req.params;
        const { entityType, minQualityScore } = req.query;

        const reports = await dataQualityService.getCustomerQualityReports(
            customerId,
            entityType,
            minQualityScore ? parseInt(minQualityScore) : null
        );

        res.json(reports);
    } catch (error) {
        logger.error('Error retrieving quality reports:', error);
        next(error);
    }
});

// Batch analyze quality
router.post('/analyze/batch', async (req, res, next) => {
    try {
        const { customerId, entities } = req.body;

        if (!customerId || !Array.isArray(entities)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Missing required fields: customerId, entities (array)'
            });
        }

        const results = await Promise.all(
            entities.map(async ({ entityType, data }) => {
                try {
                    const report = await dataQualityService.analyzeQuality(entityType, data);
                    await dataQualityService.storeQualityReport(customerId, report);
                    return report;
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
        logger.error('Error in batch quality analysis:', error);
        next(error);
    }
});

module.exports = router; 