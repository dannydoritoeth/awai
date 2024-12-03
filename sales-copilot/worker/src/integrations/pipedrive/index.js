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
            
            // Process deals, leads, and activities
            const [deals, leads, activities] = await Promise.all([
                this.fetchDeals(integration),
                this.fetchLeads(integration),
                this.fetchActivities(integration)
            ]);
            
            if (deals.length === 0 && leads.length === 0 && activities.length === 0) {
                console.log('No data found to process');
                return;
            }

            // Create and store vectors for all types
            const dealVectors = await this.createDealVectors(deals, integration);
            const leadVectors = await this.createLeadVectors(leads, integration);
            const activityVectors = await this.createActivityVectors(activities, integration);
            
            await this.storeVectors([...dealVectors, ...leadVectors, ...activityVectors]);
            await this.updateSyncStatus(syncId, deals.length + leads.length + activities.length, integration.id);

            console.log(`Successfully processed ${deals.length} deals, ${leads.length} leads, and ${activities.length} activities for customer ${integration.customer_id}`);
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

    async fetchActivities(integration) {
        const client = new PipedriveClient(integration.connection_settings);
        console.log('Fetching activities from Pipedrive...');
        const activities = await client.getAllActivities();
        console.log(`Found ${activities.length} activities to process`);
        return activities;
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

    async createActivityVectors(activities, integration) {
        if (activities.length === 0) return [];

        console.log('Creating activity texts for embedding...');
        const activityTexts = activities.map(activity => this.createActivityText(activity));
        
        console.log('Getting activity embeddings from OpenAI...');
        const embeddings = await this.embeddingService.createBatchEmbeddings(activityTexts);
        console.log(`Created ${embeddings.length} activity embeddings`);
        
        console.log('Creating activity vectors for Pinecone...');
        return activities.map((activity, index) => ({
            id: `activity_${activity.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'activity',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                activityId: activity.id,
                subject: activity.subject || '',
                type: activity.type || '',
                dueDate: activity.due_date || '',
                dueTime: activity.due_time || '',
                duration: activity.duration || '',
                dealId: activity.deal_id?.toString() || '',
                leadId: activity.lead_id?.toString() || '',
                personId: activity.person_id?.toString() || '',
                organizationId: activity.org_id?.toString() || '',
                note: activity.note || '',
                publicDescription: activity.public_description || '',
                location: activity.location || '',
                done: !!activity.done,
                marked_as_done_time: activity.marked_as_done_time || '',
                active_flag: !!activity.active_flag,
                updateTime: activity.update_time || '',
                addTime: activity.add_time || ''
            }
        }));
    }

    createActivityText(activity) {
        const parts = [
            `Subject: ${activity.subject || ''}`,
            `Type: ${activity.type || ''}`,
            `Due: ${activity.due_date || ''} ${activity.due_time || ''}`,
            `Status: ${activity.done ? 'Done' : 'Active'}`,
            activity.note ? `Note: ${activity.note}` : null,
            activity.public_description ? `Description: ${activity.public_description}` : null,
            activity.location ? `Location: ${activity.location}` : null
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