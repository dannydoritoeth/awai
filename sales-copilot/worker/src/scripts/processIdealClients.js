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

async function processIdealClients(portalId, type = 'contacts') {
    try {
        logger.info(`Starting ideal clients processing for portal ${portalId}`);

        // Get access token from database
        const accessToken = await getHubspotAccessToken(portalId);
        const hubspotClient = new HubspotClient(accessToken);

        // Initialize Pinecone client
        const pc = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });

        // Initialize OpenAI embeddings
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: 'text-embedding-3-large'
        });

        // Get Pinecone index and initialize vector store
        const pineconeIndex = pc.Index(process.env.PINECONE_INDEX_NAME);
        const vectorStore = new PineconeStore(embeddings, { pineconeIndex });

        // Update idealClientService with the vector store and namespace
        idealClientService.setVectorStore(vectorStore, portalId.toString());

        // Process the requested type
        logger.info(`Processing ${type}...`);
        const results = await idealClientService.processHubSpotLists(
            hubspotClient, 
            type
        );
        logger.info(`${type} processing complete:`, results.summary);

        return {
            type,
            summary: results.summary,
            namespace: portalId.toString()
        };

    } catch (error) {
        logger.error('Error processing ideal clients:', error);
        throw error;
    }
}

// Command line execution
if (require.main === module) {
    // Parse portal_id and type from command line arguments
    const args = process.argv.slice(2);
    const portalIdArg = args.find(arg => arg.startsWith('--portal_id='));
    const typeArg = args.find(arg => arg.startsWith('--type='));
    
    if (!portalIdArg) {
        logger.error('--portal_id parameter is required');
        process.exit(1);
    }

    const portalId = portalIdArg.split('=')[1];
    const type = typeArg ? typeArg.split('=')[1] : 'contacts';

    // Validate type
    if (!['contacts', 'companies'].includes(type)) {
        logger.error('Invalid type. Must be either "contacts" or "companies"');
        process.exit(1);
    }

    processIdealClients(portalId, type)
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