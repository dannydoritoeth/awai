const config = require('./config/config');
const PipedriveIntegration = require('./integrations/pipedrive');
const PineconeService = require('./services/pineconeService');
const EmbeddingService = require('./services/embeddingService');
const dbHelper = require('./services/dbHelper');

class Worker {
    constructor() {
        if (!config.pinecone.apiKey) {
            throw new Error('Missing Pinecone API key');
        }

        const pineconeService = new PineconeService(config.pinecone.apiKey);
        const embeddingService = new EmbeddingService(config.openai.apiKey);

        this.integrations = {
            pipedrive: new PipedriveIntegration(pineconeService, embeddingService)
        };
    }

    async processCustomerIntegrations() {
        try {
            // Get all active customer integrations
            const result = await dbHelper.query(`
                SELECT 
                    ci.id,
                    ci.customer_id,
                    ci.credentials,
                    ci.connection_settings,
                    c.name as customer_name,
                    i.type as integration_type
                FROM customer_integrations ci
                JOIN customers c ON c.id = ci.customer_id
                JOIN integrations i ON i.id = ci.integration_id
                WHERE ci.is_active = true
                AND ci.auth_status = 'active'
            `);

            for (const integration of result.rows) {
                const processor = this.integrations[integration.integration_type];
                if (processor) {
                    await processor.process(integration);
                } else {
                    console.warn(`No processor found for integration type: ${integration.integration_type}`);
                }
            }
        } catch (error) {
            console.error('Error processing integrations:', error);
        }
    }
}

// Run the worker
const worker = new Worker();
worker.processCustomerIntegrations()
    .then(() => {
        console.log('Worker completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Worker failed:', error);
        process.exit(1);
    }); 