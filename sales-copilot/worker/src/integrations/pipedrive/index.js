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
            
            // Process both deals and leads
            const [deals, leads] = await Promise.all([
                this.fetchDeals(integration),
                this.fetchLeads(integration)
            ]);
            
            if (deals.length === 0 && leads.length === 0) {
                console.log('No data found to process');
                return;
            }

            // Create and store vectors for both
            const dealVectors = await this.createDealVectors(deals, integration);
            const leadVectors = await this.createLeadVectors(leads, integration);
            
            await this.storeVectors([...dealVectors, ...leadVectors]);
            await this.updateSyncStatus(syncId, deals.length + leads.length, integration.id);

            console.log(`Successfully processed ${deals.length} deals and ${leads.length} leads for customer ${integration.customer_id}`);
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

    async fetchLeads(integration) {
        const client = new PipedriveClient(integration.connection_settings);
        console.log('Fetching leads from Pipedrive...');
        const leads = await client.getAllLeads();
        console.log(`Found ${leads.length} leads to process`);
        return leads;
    }

    async createDealVectors(deals, integration) {
        if (deals.length === 0) return [];
        
        console.log('Creating deal texts for embedding...');
        const dealTexts = deals.map(deal => this.embeddingService.createDealText(deal));
        
        console.log('Getting deal embeddings from OpenAI...');
        const embeddings = await this.embeddingService.createBatchEmbeddings(dealTexts);
        console.log(`Created ${embeddings.length} deal embeddings`);
        
        console.log('Creating deal vectors for Pinecone...');
        return deals.map((deal, index) => ({
            id: `deal_${deal.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'deal',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                dealId: deal.id,
                dealTitle: deal.title || '',
                dealStatus: deal.status || '',
                dealValue: deal.value || 0,
                dealCurrency: deal.currency || '',
                dealStage: deal.stage_id?.toString() || '',
                lastUpdated: deal.update_time || ''
            }
        }));
    }

    async createLeadVectors(leads, integration) {
        if (leads.length === 0) return [];

        console.log('Creating lead texts for embedding...');
        const leadTexts = leads.map(lead => this.createLeadText(lead));
        
        console.log('Getting lead embeddings from OpenAI...');
        const embeddings = await this.embeddingService.createBatchEmbeddings(leadTexts);
        console.log(`Created ${embeddings.length} lead embeddings`);
        
        console.log('Creating lead vectors for Pinecone...');
        return leads.map((lead, index) => ({
            id: `lead_${lead.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'lead',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                leadId: lead.id,
                leadTitle: lead.title || '',
                leadValue: lead.value?.amount || 0,
                leadCurrency: lead.value?.currency || '',
                personName: lead.person_name || '',
                organizationName: lead.organization_name || '',
                expectedCloseDate: lead.expected_close_date || '',
                lastUpdated: lead.update_time || '',
                source: lead.source_name || '',
                status: lead.status || '',
                ownerId: lead.owner_id?.toString() || ''
            }
        }));
    }

    createLeadText(lead) {
        const parts = [
            `Title: ${lead.title}`,
            `Person: ${lead.person_name || 'Unknown'}`,
            `Organization: ${lead.organization_name || 'Unknown'}`,
            `Value: ${lead.value?.amount || 0} ${lead.value?.currency || ''}`,
            `Source: ${lead.source_name || 'Unknown'}`,
            `Status: ${lead.status || 'Unknown'}`,
            `Notes: ${lead.note || ''}`,
        ];

        return parts.filter(part => part).join('\n');
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