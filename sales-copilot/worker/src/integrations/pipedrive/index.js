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
            
            // Process deals, leads, activities, people, and notes
            const [deals, leads, activities, people, notes] = await Promise.all([
                this.fetchDeals(integration),
                this.fetchLeads(integration),
                this.fetchActivities(integration),
                this.fetchPeople(integration),
                this.fetchNotes(integration)
            ]);
            
            if (deals.length === 0 && leads.length === 0 && activities.length === 0 && people.length === 0 && notes.length === 0) {
                console.log('No data found to process');
                return;
            }

            // Create and store vectors for all types
            const dealVectors = await this.createDealVectors(deals, integration);
            const leadVectors = await this.createLeadVectors(leads, integration);
            const activityVectors = await this.createActivityVectors(activities, integration);
            const peopleVectors = await this.createPeopleVectors(people, integration);
            const noteVectors = await this.createNoteVectors(notes, integration);
            
            await this.storeVectors([...dealVectors, ...leadVectors, ...activityVectors, ...peopleVectors, ...noteVectors]);
            await this.updateSyncStatus(syncId, deals.length + leads.length + activities.length + people.length + notes.length, integration.id);

            console.log(`Successfully processed ${deals.length} deals, ${leads.length} leads, ${activities.length} activities, ${people.length} people, and ${notes.length} notes for customer ${integration.customer_id}`);
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

    async fetchPeople(integration) {
        const client = new PipedriveClient(integration.connection_settings);
        console.log('Fetching people from Pipedrive...');
        const people = await client.getAllPeople();
        console.log(`Found ${people.length} people to process`);
        return people;
    }

    async fetchNotes(integration) {
        const client = new PipedriveClient(integration.connection_settings);
        console.log('Fetching notes from Pipedrive...');
        const notes = await client.getAllNotes();
        console.log(`Found ${notes.length} notes to process`);
        return notes;
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

    async createPeopleVectors(people, integration) {
        if (people.length === 0) return [];

        console.log('Creating people texts for embedding...');
        const peopleTexts = people.map(person => this.createPersonText(person));
        
        console.log('Getting people embeddings from OpenAI...');
        const embeddings = await this.embeddingService.createBatchEmbeddings(peopleTexts);
        console.log(`Created ${embeddings.length} people embeddings`);
        
        console.log('Creating people vectors for Pinecone...');
        return people.map((person, index) => ({
            id: `person_${person.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'person',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                personId: person.id,
                name: person.name || '',
                firstName: person.first_name || '',
                lastName: person.last_name || '',
                email: this.formatEmails(person.email) || '',
                phone: this.formatPhones(person.phone) || '',
                organizationId: person.org_id?.toString() || '',
                organizationName: person.org_name || '',
                title: person.title || '',
                visibleTo: person.visible_to || '',
                ownerId: person.owner_id?.toString() || '',
                addTime: person.add_time || '',
                updateTime: person.update_time || '',
                activeFlag: !!person.active_flag,
                labels: Array.isArray(person.labels) ? person.labels.join(', ') : '',
                openDealsCount: person.open_deals_count?.toString() || '0',
                wonDealsCount: person.won_deals_count?.toString() || '0',
                lostDealsCount: person.lost_deals_count?.toString() || '0',
                lastActivityDate: person.last_activity_date || '',
                nextActivityDate: person.next_activity_date || ''
            }
        }));
    }

    createPersonText(person) {
        const parts = [
            `Name: ${person.name || ''}`,
            person.title ? `Title: ${person.title}` : null,
            person.org_name ? `Organization: ${person.org_name}` : null,
            person.email ? `Email: ${this.formatEmails(person.email)}` : null,
            person.phone ? `Phone: ${this.formatPhones(person.phone)}` : null,
            Array.isArray(person.labels) && person.labels.length > 0 ? `Labels: ${person.labels.join(', ')}` : null,
            `Deals: ${person.open_deals_count || 0} open, ${person.won_deals_count || 0} won, ${person.lost_deals_count || 0} lost`,
            person.last_activity_date ? `Last Activity: ${person.last_activity_date}` : null,
            person.next_activity_date ? `Next Activity: ${person.next_activity_date}` : null
        ];

        return parts.filter(part => part).join('\n');
    }

    formatEmails(emails) {
        if (!emails) return '';
        if (Array.isArray(emails)) {
            return emails.map(e => e.value).join(', ');
        }
        return emails;
    }

    formatPhones(phones) {
        if (!phones) return '';
        if (Array.isArray(phones)) {
            return phones.map(p => p.value).join(', ');
        }
        return phones;
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

    async createNoteVectors(notes, integration) {
        if (notes.length === 0) return [];

        console.log('Creating note texts for embedding...');
        const noteTexts = notes.map(note => this.createNoteText(note));
        
        console.log('Getting note embeddings from OpenAI...');
        const embeddings = await this.embeddingService.createBatchEmbeddings(noteTexts);
        console.log(`Created ${embeddings.length} note embeddings`);
        
        console.log('Creating note vectors for Pinecone...');
        return notes.map((note, index) => ({
            id: `note_${note.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'note',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                noteId: note.id,
                content: note.content || '',
                addTime: note.add_time || '',
                updateTime: note.update_time || '',
                activeFlag: !!note.active_flag,
                dealId: note.deal_id?.toString() || '',
                personId: note.person_id?.toString() || '',
                organizationId: note.org_id?.toString() || '',
                userId: note.user_id?.toString() || '',
                leadId: note.lead_id?.toString() || '',
                lastUpdateUserId: note.last_update_user_id?.toString() || '',
                pinned: !!note.pinned_to_deal_flag || !!note.pinned_to_organization_flag || !!note.pinned_to_person_flag,
                pinnedToDeal: !!note.pinned_to_deal_flag,
                pinnedToOrganization: !!note.pinned_to_organization_flag,
                pinnedToPerson: !!note.pinned_to_person_flag
            }
        }));
    }

    createNoteText(note) {
        const parts = [
            note.content ? `Content: ${note.content}` : null,
            note.deal_id ? `Deal ID: ${note.deal_id}` : null,
            note.person_id ? `Person ID: ${note.person_id}` : null,
            note.org_id ? `Organization ID: ${note.org_id}` : null,
            note.lead_id ? `Lead ID: ${note.lead_id}` : null,
            note.pinned_to_deal_flag ? 'Pinned to Deal' : null,
            note.pinned_to_organization_flag ? 'Pinned to Organization' : null,
            note.pinned_to_person_flag ? 'Pinned to Person' : null
        ];

        return parts.filter(part => part).join('\n');
    }
}

module.exports = PipedriveIntegration; 