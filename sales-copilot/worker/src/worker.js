const config = require('./config/config');
const PipedriveIntegration = require('./integrations/pipedrive');
const AgentboxIntegration = require('./integrations/agentbox');
const PineconeService = require('./services/pineconeService');
const EmbeddingService = require('./services/embeddingService');
const dbHelper = require('./services/dbHelper');
const yargs = require('yargs');

// Parse command line arguments
const argv = yargs
    .option('test-mode', {
        alias: 't',
        type: 'boolean',
        description: 'Run in test mode with limited records'
    })
    .option('limit', {
        alias: 'l',
        type: 'number',
        default: 3,
        description: 'Number of records to process in test mode'
    })
    .argv;

class Worker {
    constructor() {
        // Initialize services
        this.embeddingService = new EmbeddingService(config.openai.apiKey);
        this.pineconeService = new PineconeService(config.pinecone.apiKey);

        // Store test mode settings
        this.testMode = argv.testMode;
        this.limit = argv.limit;

        // Initialize integrations with services and test mode settings
        this.pipedriveIntegration = new PipedriveIntegration(
            this.embeddingService,
            this.pineconeService,
            this.testMode,
            this.limit
        );
        this.agentboxIntegration = new AgentboxIntegration(
            this.embeddingService,
            this.pineconeService,
            this.testMode,
            this.limit
        );
    }

    async processCustomerIntegrations() {
        try {
            console.log('\n=== Starting Customer Integrations Processing ===');
            // Base query
            let query = `
                SELECT 
                    ci.*,
                    c.name as customer_name,
                    i.type as integration_type
                FROM customer_integrations ci
                JOIN customers c ON ci.customer_id = c.id
                JOIN integrations i ON ci.integration_id = i.id
                WHERE ci.is_active = true
                AND ci.auth_status = 'active'
            `;

            // Add test mode limit if enabled
            if (this.testMode) {
                query += ` LIMIT ${this.limit}`;
                console.log(`Running in test mode with limit: ${this.limit}`);
            }

            const result = await dbHelper.query(query);
            console.log(`Found ${result.rows.length} integrations to process`);

            for (const integration of result.rows) {
                try {
                    console.log(`\nProcessing integration:`, {
                        type: integration.integration_type,
                        customerId: integration.customer_id,
                        customerName: integration.customer_name
                    });
                    
                    if (integration.integration_type === 'pipedrive') {
                        console.log('Starting Pipedrive integration processing');
                        await this.pipedriveIntegration.process(integration);
                        console.log('Completed Pipedrive integration processing');
                    } else if (integration.integration_type === 'agentbox') {
                        console.log('Starting Agentbox integration processing');
                        await this.agentboxIntegration.process(integration);
                        console.log('Completed Agentbox integration processing');
                    }
                } catch (error) {
                    console.error(`Error processing ${integration.integration_type} integration:`, error);
                }
            }

            console.log('\n=== Completed All Integrations Processing ===');
        } catch (error) {
            console.error('Error processing integrations:', error);
            throw error;
        }
    }
}

// Create and run worker
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