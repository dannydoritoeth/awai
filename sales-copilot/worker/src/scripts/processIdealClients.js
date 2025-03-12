require('dotenv').config();
const { OpenAIEmbeddings } = require("@langchain/openai");
const { PineconeStore } = require("@langchain/pinecone");
const { Pinecone } = require("@pinecone-database/pinecone");
const HubspotClient = require('../integrations/hubspot/client');
const idealClientService = require('../services/idealClientService');
const getHubspotAccessToken = require('../utils/getHubspotToken');
const Logger = require('../services/logger');

// Initialize logger
const logger = new Logger();

/**
 * Process ideal and less-ideal clients from HubSpot lists
 * 
 * Usage:
 * node src/scripts/processIdealClients.js --type=contacts
 * node src/scripts/processIdealClients.js --type=companies
 */

async function processIdealClients(portalId) {
    try {
        logger.info(`Starting ideal clients processing for portal ${portalId}`);

        // Get access token from database
        const accessToken = await getHubspotAccessToken(portalId);
        const hubspotClient = new HubspotClient(accessToken);

        // Initialize Pinecone client
        const pc = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });

        // Initialize embedding
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
        });

        // Get Pinecone index and initialize vector store
        const pineconeIndex = pc.Index("ideal-clients");
        const vectorStore = new PineconeStore(embeddings, { pineconeIndex });

        // Update idealClientService with the vector store
        idealClientService.setVectorStore(vectorStore);

        // Process contacts
        logger.info('Processing contacts...');
        const contactResults = await idealClientService.processHubSpotLists(
            hubspotClient, 
            'contacts'
        );
        logger.info('Contact processing complete:', contactResults.summary);

        // Process companies
        logger.info('Processing companies...');
        const companyResults = await idealClientService.processHubSpotLists(
            hubspotClient, 
            'companies'
        );
        logger.info('Company processing complete:', companyResults.summary);

        return {
            contacts: contactResults.summary,
            companies: companyResults.summary
        };

    } catch (error) {
        logger.error('Error processing ideal clients:', error);
        throw error;
    }
}

// Command line execution
if (require.main === module) {
    // Parse portal_id from command line arguments
    const args = process.argv.slice(2);
    const portalIdArg = args.find(arg => arg.startsWith('--portal_id='));
    
    if (!portalIdArg) {
        logger.error('--portal_id parameter is required');
        process.exit(1);
    }

    const portalId = portalIdArg.split('=')[1];

    processIdealClients(portalId)
        .then(results => {
            logger.info('Process completed successfully:', results);
            process.exit(0);
        })
        .catch(error => {
            logger.error('Process failed:', error);
            process.exit(1);
        });
}

module.exports = {
    processIdealClients
}; 