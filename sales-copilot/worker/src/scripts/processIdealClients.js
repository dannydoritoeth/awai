require('dotenv').config();
const HubspotClient = require('../integrations/hubspot/client');
const idealClientService = require('../services/idealClientService');
const logger = require('../services/logger');

/**
 * Process ideal and less-ideal clients from HubSpot lists
 * 
 * Usage:
 * node src/scripts/processIdealClients.js --type=contacts
 * node src/scripts/processIdealClients.js --type=companies
 */

async function main() {
    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        const typeArg = args.find(arg => arg.startsWith('--type='));
        const type = typeArg ? typeArg.split('=')[1] : 'contacts';

        logger.info(`Starting ideal client processing for type: ${type}`);

        // Initialize HubSpot client
        if (!process.env.HUBSPOT_ACCESS_TOKEN) {
            throw new Error('HUBSPOT_ACCESS_TOKEN is required in environment variables');
        }
        
        const hubspotClient = new HubspotClient(process.env.HUBSPOT_ACCESS_TOKEN);
        
        // Process HubSpot lists
        logger.info(`Fetching ${type} from HubSpot lists: Ideal-${type} and Less-Ideal-${type}`);
        const result = await idealClientService.processHubSpotLists(hubspotClient, type);
        
        // Log results
        logger.info('Processing complete', {
            type: result.type,
            ideal: {
                processed: result.summary.ideal.processed,
                successful: result.summary.ideal.successful
            },
            lessIdeal: {
                processed: result.summary.lessIdeal.processed,
                successful: result.summary.lessIdeal.successful
            }
        });

        // Example: Analyze a test client
        if (result.summary.ideal.successful > 0) {
            logger.info('Testing client analysis with a sample client...');
            
            // Get a sample client from the processed data
            const sampleClient = result.details.ideal[0];
            
            // Fetch the client details
            const clientData = type === 'contacts' 
                ? await hubspotClient.getDetailedContactInfo(sampleClient.id)
                : await hubspotClient.getDetailedCompanyInfo(sampleClient.id);
            
            // Analyze the client fit
            const analysis = await idealClientService.analyzeClientFit(clientData, type);
            
            logger.info('Sample client analysis', {
                score: analysis.score,
                classification: analysis.classification,
                similarIdealCount: analysis.metrics.idealCount,
                similarLessIdealCount: analysis.metrics.lessIdealCount
            });
        }

        logger.info('Script completed successfully');
    } catch (error) {
        logger.error('Error processing ideal clients:', error);
        process.exit(1);
    }
}

main(); 