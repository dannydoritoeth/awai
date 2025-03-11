const HubspotClient = require('../integrations/hubspot/client');
const idealClientService = require('../services/idealClientService');
const logger = require('../services/logger');

/**
 * Analyze a client against the ideal client model
 * 
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
async function analyzeClient(req, res) {
    try {
        const { clientId, type = 'contacts', accessToken } = req.body;

        if (!clientId) {
            return res.status(400).json({
                success: false,
                error: 'Client ID is required'
            });
        }

        if (!accessToken) {
            return res.status(400).json({
                success: false,
                error: 'HubSpot access token is required'
            });
        }

        // Initialize HubSpot client
        const hubspotClient = new HubspotClient(accessToken);

        // Get client data
        let clientData;
        try {
            clientData = type === 'contacts' 
                ? await hubspotClient.getDetailedContactInfo(clientId)
                : await hubspotClient.getDetailedCompanyInfo(clientId);
        } catch (error) {
            logger.error(`Error fetching ${type} data:`, error);
            return res.status(404).json({
                success: false,
                error: `${type === 'contacts' ? 'Contact' : 'Company'} not found or access denied`
            });
        }

        // Analyze client fit
        const analysis = await idealClientService.analyzeClientFit(clientData, type);

        // Return analysis
        return res.status(200).json({
            success: true,
            clientId,
            type,
            analysis: {
                score: analysis.score,
                classification: analysis.classification,
                analysis: analysis.analysis,
                metrics: analysis.metrics
            },
            similarClients: {
                ideal: analysis.similarClients.ideal.map(client => ({
                    id: client.metadata.source_id,
                    score: client.score,
                    type: client.metadata.type
                })),
                lessIdeal: analysis.similarClients.lessIdeal.map(client => ({
                    id: client.metadata.source_id,
                    score: client.score,
                    type: client.metadata.type
                }))
            }
        });
    } catch (error) {
        logger.error('Error analyzing client:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}

/**
 * Train the ideal client model with data from HubSpot lists
 * 
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
async function trainModel(req, res) {
    try {
        const { type = 'contacts', accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({
                success: false,
                error: 'HubSpot access token is required'
            });
        }

        // Initialize HubSpot client
        const hubspotClient = new HubspotClient(accessToken);

        // Process HubSpot lists
        const result = await idealClientService.processHubSpotLists(hubspotClient, type);

        // Return results
        return res.status(200).json({
            success: true,
            type,
            summary: {
                ideal: {
                    processed: result.summary.ideal.processed,
                    successful: result.summary.ideal.successful
                },
                lessIdeal: {
                    processed: result.summary.lessIdeal.processed,
                    successful: result.summary.lessIdeal.successful
                }
            }
        });
    } catch (error) {
        logger.error('Error training model:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}

module.exports = {
    analyzeClient,
    trainModel
}; 