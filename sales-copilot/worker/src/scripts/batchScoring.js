const { OpenAIEmbeddings } = require("@langchain/openai");
const { PineconeStore } = require("@langchain/pinecone");
const { Pinecone } = require("@pinecone-database/pinecone");
const HubspotClient = require('../integrations/hubspot/client');
const getHubspotAccessToken = require('../utils/getHubspotToken');
const Logger = require('../services/logger');
const fs = require('fs').promises;
const path = require('path');

// Initialize logger
const logger = new Logger();

/**
 * Process and score recently modified records by:
 * 1. Getting modified records from HubSpot
 * 2. Creating embeddings
 * 3. Finding similar records in Pinecone
 * 4. Using ChatGPT to analyze and score
 */
async function runBatchScoring(portalId) {
    try {
        logger.info(`Starting batch scoring process for portal ${portalId}`);
        
        // Get access token from database
        const accessToken = await getHubspotAccessToken(portalId);
        const hubspotClient = new HubspotClient(accessToken);
        
        // Get last run timestamp
        const lastRunTime = await getLastRunTimestamp(portalId);
        logger.info(`Processing records modified since: ${lastRunTime}`);

        // Initialize Pinecone client
        const pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });

        // Initialize embedding
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: 'text-embedding-3-large'
        });

        // Get Pinecone index and initialize vector store
        const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);
        const vectorStore = new PineconeStore(embeddings, { 
            pineconeIndex,
            namespace: portalId.toString()
        });

        // Get modified records from HubSpot
        const modifiedRecords = await hubspotClient.getModifiedRecords(lastRunTime);
        logger.info(`Found ${modifiedRecords.length} modified records`);

        const results = {
            processed: 0,
            successful: 0,
            failed: 0,
            errors: []
        };

        // Process each record
        for (const record of modifiedRecords) {
            try {
                results.processed++;

                // Create embedding for the record
                const recordContent = createRecordContent(record);
                const recordEmbedding = await embeddings.embedQuery(recordContent);

                // Find similar records in Pinecone
                const similarRecords = await vectorStore.similaritySearch(recordContent, 5);
                logger.info(`Found ${similarRecords.length} similar records for ${record.id}`);

                // Get score from ChatGPT
                const score = await analyzeAndScore(record, similarRecords);
                
                // Update record in HubSpot with the score
                await hubspotClient.updateRecord(record.id, {
                    ideal_client_score: score.value,
                    ideal_client_classification: score.classification,
                    ideal_client_analysis: score.analysis,
                    ideal_client_last_scored: new Date().toISOString()
                });

                results.successful++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    recordId: record.id,
                    error: error.message
                });
                logger.error(`Error processing record ${record.id}:`, error);
            }
        }

        // Save current timestamp for next run
        await saveLastRunTimestamp(portalId);

        logger.info('Batch scoring complete!', results);
        return results;

    } catch (error) {
        logger.error('Error in batch scoring process:', error);
        throw error;
    }
}

/**
 * Create standardized content from a record for embedding
 */
function createRecordContent(record) {
    return `
        ${record.properties?.firstname || ''} ${record.properties?.lastname || ''}
        Company: ${record.properties?.company || ''}
        Industry: ${record.properties?.industry || ''}
        Email: ${record.properties?.email || ''}
        Lifecycle Stage: ${record.properties?.lifecyclestage || ''}
        Deal Stage: ${record.properties?.dealstage || ''}
        Last Activity Date: ${record.properties?.lastactivitydate || ''}
    `.trim();
}

/**
 * Analyze record against similar records using ChatGPT
 */
async function analyzeAndScore(record, similarRecords) {
    const openai = new OpenAI();
    
    const prompt = `
        Analyze this potential client against our known ideal and less-ideal clients:

        Current Client:
        ${JSON.stringify(record, null, 2)}

        Similar Clients (with their classifications):
        ${similarRecords.map(r => JSON.stringify(r, null, 2)).join('\n')}

        Please provide:
        1. A score from 0-100 indicating how well this client matches our ideal client profile
        2. A classification (Strongly Ideal, Moderately Ideal, Neutral, Less Ideal, Not Ideal)
        3. A brief analysis explaining the score

        Format the response as JSON.
    `;

    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
    });

    return JSON.parse(completion.choices[0].message.content);
}

/**
 * Get the timestamp of the last successful run
 */
async function getLastRunTimestamp(portalId) {
    try {
        const timestampFile = path.join(__dirname, '..', 'data', `last_run_${portalId}.json`);
        const data = await fs.readFile(timestampFile, 'utf8');
        const { timestamp } = JSON.parse(data);
        return timestamp;
    } catch (error) {
        // If file doesn't exist or is invalid, return a timestamp from 24 hours ago
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);
        return yesterday.toISOString();
    }
}

/**
 * Save the current timestamp for the next run
 */
async function saveLastRunTimestamp(portalId) {
    try {
        const timestampFile = path.join(__dirname, '..', 'data', `last_run_${portalId}.json`);
        const data = {
            timestamp: new Date().toISOString(),
            lastRun: new Date().toISOString()
        };
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(timestampFile), { recursive: true });
        
        // Save timestamp
        await fs.writeFile(timestampFile, JSON.stringify(data, null, 2));
    } catch (error) {
        logger.error('Error saving timestamp:', error);
        // Continue execution even if saving timestamp fails
    }
}

// Command line execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const portalIdArg = args.find(arg => arg.startsWith('--portal_id='));
    
    if (!portalIdArg) {
        logger.error('--portal_id parameter is required');
        process.exit(1);
    }

    const portalId = portalIdArg.split('=')[1];

    runBatchScoring(portalId)
        .then(results => {
            logger.info('Batch scoring completed successfully:', results);
            process.exit(0);
        })
        .catch(error => {
            logger.error('Batch scoring failed:', error);
            process.exit(1);
        });
}

module.exports = {
    runBatchScoring
}; 