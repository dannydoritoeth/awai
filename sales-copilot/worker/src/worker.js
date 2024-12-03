const config = require('./config/config');
const PipedriveClient = require('./integrations/pipedrive/client');
const PineconeService = require('./services/pineconeService');
const EmbeddingService = require('./services/embeddingService');
const dbHelper = require('./services/dbHelper');

class Worker {
    constructor() {
        if (!config.pinecone.apiKey) {
            throw new Error('Missing Pinecone API key');
        }

        this.pineconeService = new PineconeService(config.pinecone.apiKey);
        this.embeddingService = new EmbeddingService(config.openai.apiKey);
    }

    async processCustomerIntegrations() {
        try {
            // Initialize Pinecone first
            await this.pineconeService.initialize();
            
            // Get all active customer integrations for Pipedrive
            const result = await dbHelper.query(`
                SELECT 
                    ci.id,
                    ci.customer_id,
                    ci.credentials,
                    ci.connection_settings,
                    c.name as customer_name
                FROM customer_integrations ci
                JOIN customers c ON c.id = ci.customer_id
                JOIN integrations i ON i.id = ci.integration_id
                WHERE i.type = 'pipedrive'
                AND ci.is_active = true
                AND ci.auth_status = 'active'
            `);

            for (const integration of result.rows) {
                await this.processPipedriveIntegration(integration);
            }
        } catch (error) {
            console.error('Error processing integrations:', error);
        }
    }

    async processPipedriveIntegration(integration) {
        let syncId = null;
        try {
            console.log(`Processing integration for customer ${integration.customer_id} (${integration.customer_name})`);
            
            const syncHistoryResult = await dbHelper.query(`
                INSERT INTO sync_history 
                (customer_integration_id, status, sync_type)
                VALUES ($1, 'in_progress', 'full')
                RETURNING id
            `, [integration.id]);

            syncId = syncHistoryResult.rows[0].id;

            const client = new PipedriveClient(
                integration.connection_settings
            );

            // Get all deals
            console.log('Fetching deals from Pipedrive...');
            const deals = await client.getAllDeals();
            console.log(`Found ${deals.length} deals to process`);
            
            if (deals.length === 0) {
                console.log('No deals found to process');
                return;
            }

            // Create deal texts for embedding
            console.log('Creating deal texts for embedding...');
            const dealTexts = deals.map(deal => this.embeddingService.createDealText(deal));
            
            // Get embeddings in batches
            console.log('Getting embeddings from OpenAI...');
            const embeddings = await this.embeddingService.createBatchEmbeddings(dealTexts);
            console.log(`Created ${embeddings.length} embeddings`);
            
            // Create vectors with embeddings
            console.log('Creating vectors for Pinecone...');
            const dealVectors = deals.map((deal, index) => ({
                id: deal.id,
                vector: embeddings[index],
                metadata: {
                    customerId: integration.customer_id,
                    customerName: integration.customer_name,
                    dealId: deal.id,
                    dealTitle: deal.title,
                    dealStatus: deal.status,
                    dealValue: deal.value,
                    dealCurrency: deal.currency,
                    dealStage: deal.stage_id,
                    lastUpdated: deal.update_time,
                }
            }));

            console.log(`Upserting ${dealVectors.length} vectors to Pinecone...`);
            await this.pineconeService.upsertBatch(dealVectors);
            console.log('Upsert to Pinecone complete');

            // Update sync history
            await dbHelper.query(`
                UPDATE sync_history
                SET status = 'completed',
                    completed_at = CURRENT_TIMESTAMP,
                    records_processed = $1
                WHERE id = $2
            `, [deals.length, syncId]);

            // Update last sync time
            await dbHelper.query(`
                UPDATE customer_integrations
                SET last_sync_at = CURRENT_TIMESTAMP,
                    last_full_sync = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [integration.id]);

            console.log(`Successfully processed ${deals.length} deals for customer ${integration.customer_id}`);

        } catch (error) {
            console.error(`Error processing Pipedrive integration for customer ${integration.customer_id}:`, error);
            
            if (syncId) {
                await dbHelper.query(`
                    UPDATE sync_history
                    SET status = 'failed',
                        completed_at = CURRENT_TIMESTAMP,
                        error_message = $1
                    WHERE id = $2
                `, [error.message, syncId]);
            }
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