const PipedriveClient = require('./client');
const dbHelper = require('../../services/dbHelper');

class PipedriveIntegration {
    constructor(pineconeService, embeddingService) {
        this.pineconeService = pineconeService;
        this.embeddingService = embeddingService;
    }

    async process(integration) {
        let syncId = null;
        try {
            console.log(`Processing Pipedrive integration for customer ${integration.customer_id} (${integration.customer_name})`);
            
            syncId = await this.createSyncRecord(integration.id);
            const deals = await this.fetchDeals(integration);
            
            if (deals.length === 0) {
                console.log('No deals found to process');
                return;
            }

            const vectors = await this.createVectors(deals, integration);
            await this.storeVectors(vectors);
            await this.updateSyncStatus(syncId, deals.length, integration.id);

            console.log(`Successfully processed ${deals.length} deals for customer ${integration.customer_id}`);
        } catch (error) {
            console.error(`Error processing Pipedrive integration for customer ${integration.customer_id}:`, error);
            await this.updateSyncError(syncId, error.message);
            throw error;
        }
    }

    async createSyncRecord(integrationId) {
        const result = await dbHelper.query(`
            INSERT INTO sync_history 
            (customer_integration_id, status, sync_type)
            VALUES ($1, 'in_progress', 'full')
            RETURNING id
        `, [integrationId]);
        return result.rows[0].id;
    }

    async fetchDeals(integration) {
        const client = new PipedriveClient(integration.connection_settings);
        console.log('Fetching deals from Pipedrive...');
        const deals = await client.getAllDeals();
        console.log(`Found ${deals.length} deals to process`);
        return deals;
    }

    async createVectors(deals, integration) {
        console.log('Creating deal texts for embedding...');
        const dealTexts = deals.map(deal => this.embeddingService.createDealText(deal));
        
        console.log('Getting embeddings from OpenAI...');
        const embeddings = await this.embeddingService.createBatchEmbeddings(dealTexts);
        console.log(`Created ${embeddings.length} embeddings`);
        
        console.log('Creating vectors for Pinecone...');
        return deals.map((deal, index) => ({
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
    }

    async storeVectors(vectors) {
        console.log(`Upserting ${vectors.length} vectors to Pinecone...`);
        await this.pineconeService.upsertBatch(vectors);
        console.log('Upsert to Pinecone complete');
    }

    async updateSyncStatus(syncId, recordCount, integrationId) {
        await dbHelper.query(`
            UPDATE sync_history
            SET status = 'completed',
                completed_at = CURRENT_TIMESTAMP,
                records_processed = $1
            WHERE id = $2
        `, [recordCount, syncId]);

        await dbHelper.query(`
            UPDATE customer_integrations
            SET last_sync_at = CURRENT_TIMESTAMP,
                last_full_sync = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [integrationId]);
    }

    async updateSyncError(syncId, errorMessage) {
        if (syncId) {
            await dbHelper.query(`
                UPDATE sync_history
                SET status = 'failed',
                    completed_at = CURRENT_TIMESTAMP,
                    error_message = $1
                WHERE id = $2
            `, [errorMessage, syncId]);
        }
    }
}

module.exports = PipedriveIntegration; 