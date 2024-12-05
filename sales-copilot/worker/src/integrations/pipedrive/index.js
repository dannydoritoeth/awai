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
            
            // Process each entity type sequentially
            const deals = await this.fetchDeals(integration);
            const dealVectors = await this.createDealVectors(deals, integration);
            await this.storeVectors(dealVectors);
            console.log(`Processed ${deals.length} deals`);

            const leads = await this.fetchLeads(integration);
            const leadVectors = await this.createLeadVectors(leads, integration);
            await this.storeVectors(leadVectors);
            console.log(`Processed ${leads.length} leads`);

            const activities = await this.fetchActivities(integration);
            const activityVectors = await this.createActivityVectors(activities, integration);
            await this.storeVectors(activityVectors);
            console.log(`Processed ${activities.length} activities`);

            const people = await this.fetchPeople(integration);
            const peopleVectors = await this.createPeopleVectors(people, integration);
            await this.storeVectors(peopleVectors);
            console.log(`Processed ${people.length} people`);

            const notes = await this.fetchNotes(integration);
            const noteVectors = await this.createNoteVectors(notes, integration);
            await this.storeVectors(noteVectors);
            console.log(`Processed ${notes.length} notes`);

            const organizations = await this.fetchOrganizations(integration);
            const organizationVectors = await this.createOrganizationVectors(organizations, integration);
            await this.storeVectors(organizationVectors);
            console.log(`Processed ${organizations.length} organizations`);

            const totalCount = deals.length + leads.length + activities.length + 
                             people.length + notes.length + organizations.length;

            await this.updateSyncStatus(syncId, totalCount, integration.id);

            console.log(
                `Successfully processed ${totalCount} total records ` +
                `for customer ${integration.customer_id}`
            );
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

    async fetchOrganizations(integration) {
        const client = new PipedriveClient(integration.connection_settings);
        console.log('Fetching organizations from Pipedrive...');
        const organizations = await client.getAllOrganizations();
        console.log(`Found ${organizations.length} organizations to process`);
        return organizations;
    }

    async createDealVectors(deals, integration) {
        if (deals.length === 0) return [];

        console.log('Creating deal texts for embedding...');
        const dealTexts = deals.map(deal => this.createDealText(deal));
        
        console.log('Getting deal embeddings from OpenAI...');
        const embeddings = await this.embeddingService.createBatchEmbeddings(dealTexts);
        
        return deals.map((deal, index) => ({
            id: `pipedrive_deal_${deal.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'deal',
                source: 'pipedrive',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                dealId: parseInt(deal.id),
                title: deal.title || '',
                value: parseFloat(deal.value) || 0,
                currency: deal.currency || '',
                status: deal.status || '',
                stageId: deal.stage_id ? parseInt(deal.stage_id) : null,
                organizationId: deal.org_id ? parseInt(deal.org_id) : null,
                organizationName: deal.org_name || '',
                personId: deal.person_id ? parseInt(deal.person_id) : null,
                personName: deal.person_name || '',
                ownerId: deal.owner_id ? parseInt(deal.owner_id) : null,
                expectedCloseDate: deal.expected_close_date || '',
                addTime: deal.add_time || '',
                updateTime: deal.update_time || '',
                closeTime: deal.close_time || '',
                lostReason: deal.lost_reason || '',
                visibleTo: deal.visible_to || '',
                activeFlag: !!deal.active
            }
        }));
    }

    createDealText(deal) {
        const parts = [
            `Title: ${deal.title}`,
            `Value: ${deal.value} ${deal.currency}`,
            `Status: ${deal.status}`,
            `Stage: ${deal.stage_id}`,
            `Organization: ${deal.org_name}`,
            `Person: ${deal.person_name}`,
            `Expected Close Date: ${deal.expected_close_date}`,
            `Add Time: ${deal.add_time}`,
            `Update Time: ${deal.update_time}`,
            `Close Time: ${deal.close_time}`,
            `Lost Reason: ${deal.lost_reason}`,
            `Visible To: ${deal.visible_to}`,
            `Active: ${deal.active}`
        ];

        return parts.filter(part => part).join('\n');
    }

    async createLeadVectors(leads, integration) {
        if (leads.length === 0) return [];

        const leadTexts = leads.map(lead => this.createLeadText(lead));
        const embeddings = await this.embeddingService.createBatchEmbeddings(leadTexts);
        
        return leads.map((lead, index) => ({
            id: `pipedrive_lead_${lead.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'lead',
                source: 'pipedrive',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                leadId: parseInt(lead.id),
                title: lead.title || '',
                value: lead.value?.amount ? parseFloat(lead.value.amount) : 0,
                currency: lead.value?.currency || '',
                ownerId: lead.owner_id ? parseInt(lead.owner_id) : null,
                personId: lead.person_id ? parseInt(lead.person_id) : null,
                organizationId: lead.organization_id ? parseInt(lead.organization_id) : null,
                personName: lead.person_name || '',
                organizationName: lead.organization_name || '',
                expectedCloseDate: lead.expected_close_date || '',
                addTime: lead.add_time || '',
                updateTime: lead.update_time || '',
                status: lead.status || '',
                source: lead.source_name || '',
                notes: lead.note || '',
                labelIds: Array.isArray(lead.label_ids) ? lead.label_ids.map(id => parseInt(id)) : []
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

        const activityTexts = activities.map(activity => this.createActivityText(activity));
        const embeddings = await this.embeddingService.createBatchEmbeddings(activityTexts);
        
        return activities.map((activity, index) => ({
            id: `pipedrive_activity_${activity.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'activity',
                source: 'pipedrive',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                activityId: parseInt(activity.id),
                subject: activity.subject || '',
                type: activity.type || '',
                dueDate: activity.due_date || '',
                dueTime: activity.due_time || '',
                duration: activity.duration || '',
                dealId: activity.deal_id ? parseInt(activity.deal_id) : null,
                personId: activity.person_id ? parseInt(activity.person_id) : null,
                organizationId: activity.org_id ? parseInt(activity.org_id) : null,
                note: activity.note || '',
                publicDescription: activity.public_description || '',
                location: activity.location || '',
                done: !!activity.done,
                markedAsDoneTime: activity.marked_as_done_time || '',
                activeFlag: !!activity.active_flag,
                userId: activity.user_id ? parseInt(activity.user_id) : null,
                addTime: activity.add_time || '',
                updateTime: activity.update_time || ''
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
            id: `pipedrive_person_${person.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'person',
                source: 'pipedrive',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                personId: parseInt(person.id),
                name: person.name || '',
                firstName: person.first_name || '',
                lastName: person.last_name || '',
                email: Array.isArray(person.email) ? person.email.map(e => e.value).join(', ') : person.email || '',
                phone: Array.isArray(person.phone) ? person.phone.map(p => p.value).join(', ') : person.phone || '',
                organizationId: person.org_id ? parseInt(person.org_id) : null,
                organizationName: person.org_name || '',
                title: person.title || '',
                visibleTo: person.visible_to || '',
                ownerId: person.owner_id ? parseInt(person.owner_id) : null,
                labels: Array.isArray(person.labels) ? person.labels.join(', ') : '',
                openDealsCount: parseInt(person.open_deals_count || '0'),
                wonDealsCount: parseInt(person.won_deals_count || '0'),
                lostDealsCount: parseInt(person.lost_deals_count || '0'),
                lastActivityDate: person.last_activity_date || '',
                nextActivityDate: person.next_activity_date || '',
                addTime: person.add_time || '',
                updateTime: person.update_time || '',
                activeFlag: !!person.active_flag
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
        if (vectors.length === 0) return;

        console.log(`Storing ${vectors.length} vectors in Pinecone...`);
        
        // Get the customerId from the first vector's metadata since all vectors in a batch are from the same customer
        const namespace = vectors[0].metadata.customerId.toString();
        
        try {
            await this.pineconeService.upsertBatch(vectors, namespace);
            console.log(`Successfully stored vectors in namespace: ${namespace}`);
        } catch (error) {
            console.error('Error storing vectors in Pinecone:', error);
            throw error;
        }
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

        const noteTexts = notes.map(note => this.createNoteText(note));
        const embeddings = await this.embeddingService.createBatchEmbeddings(noteTexts);
        
        return notes.map((note, index) => ({
            id: `pipedrive_note_${note.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'note',
                source: 'pipedrive',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                noteId: parseInt(note.id),
                content: note.content || '',
                dealId: note.deal_id ? parseInt(note.deal_id) : null,
                personId: note.person_id ? parseInt(note.person_id) : null,
                organizationId: note.org_id ? parseInt(note.org_id) : null,
                userId: note.user_id ? parseInt(note.user_id) : null,
                addTime: note.add_time || '',
                updateTime: note.update_time || '',
                activeFlag: !!note.active_flag,
                pinnedToDeal: !!note.pinned_to_deal_flag,
                pinnedToOrganization: !!note.pinned_to_organization_flag,
                pinnedToPerson: !!note.pinned_to_person_flag,
                lastUpdateUserId: note.last_update_user_id ? parseInt(note.last_update_user_id) : null
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

    async createOrganizationVectors(organizations, integration) {
        if (organizations.length === 0) return [];

        const organizationTexts = organizations.map(org => this.createOrganizationText(org));
        const embeddings = await this.embeddingService.createBatchEmbeddings(organizationTexts);
        
        return organizations.map((org, index) => ({
            id: `pipedrive_organization_${org.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'organization',
                source: 'pipedrive',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                organizationId: parseInt(org.id),
                name: org.name || '',
                address: org.address || '',
                addressCountry: org.address_country || '',
                addressLocality: org.address_locality || '',
                addressPostalCode: org.address_postal_code || '',
                ownerId: org.owner_id ? parseInt(org.owner_id) : null,
                activeFlag: !!org.active_flag,
                visibleTo: org.visible_to || '',
                email: Array.isArray(org.email) ? org.email.map(e => e.value).join(', ') : org.email || '',
                phone: Array.isArray(org.phone) ? org.phone.map(p => p.value).join(', ') : org.phone || '',
                webDomain: org.web_domain || '',
                addTime: org.add_time || '',
                updateTime: org.update_time || '',
                labels: Array.isArray(org.labels) ? org.labels.join(', ') : '',
                openDealsCount: parseInt(org.open_deals_count || '0'),
                wonDealsCount: parseInt(org.won_deals_count || '0'),
                lostDealsCount: parseInt(org.lost_deals_count || '0'),
                lastActivityDate: org.last_activity_date || '',
                nextActivityDate: org.next_activity_date || ''
            }
        }));
    }

    createOrganizationText(org) {
        const parts = [
            `Name: ${org.name || ''}`,
            org.address ? `Address: ${[
                org.address,
                org.address_sublocality,
                org.address_locality,
                org.address_postal_code,
                org.address_country
            ].filter(Boolean).join(', ')}` : null,
            org.email ? `Email: ${Array.isArray(org.email) ? org.email.map(e => e.value).join(', ') : org.email}` : null,
            org.phone ? `Phone: ${Array.isArray(org.phone) ? org.phone.map(p => p.value).join(', ') : org.phone}` : null,
            org.web_domain ? `Website: ${org.web_domain}` : null,
            Array.isArray(org.labels) && org.labels.length > 0 ? `Labels: ${org.labels.join(', ')}` : null,
            `Deals: ${org.open_deals_count || 0} open, ${org.won_deals_count || 0} won, ${org.lost_deals_count || 0} lost`,
            org.last_activity_date ? `Last Activity: ${org.last_activity_date}` : null,
            org.next_activity_date ? `Next Activity: ${org.next_activity_date}` : null
        ];

        return parts.filter(part => part).join('\n');
    }
}

module.exports = PipedriveIntegration; 