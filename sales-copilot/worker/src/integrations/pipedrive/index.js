const PipedriveClient = require('./client');
const dbHelper = require('../../services/dbHelper');

// Helper function to clean metadata values
function cleanMetadata(metadata) {
    const cleaned = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (value === null || value === undefined) {
            continue; // Skip null/undefined values
        }
        // Convert arrays to comma-separated strings if they exist
        if (Array.isArray(value)) {
            cleaned[key] = value.join(', ');
            continue;
        }
        // Keep boolean values as is
        if (typeof value === 'boolean') {
            cleaned[key] = value;
            continue;
        }
        // Convert numbers to strings
        if (typeof value === 'number') {
            cleaned[key] = value.toString();
            continue;
        }
        // Keep string values as is
        cleaned[key] = value;
    }
    return cleaned;
}

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

        const dealTexts = deals.map(deal => this.createDealText(deal));
        const embeddings = await this.embeddingService.createBatchEmbeddings(dealTexts);
        
        return deals.map((deal, index) => ({
            id: `pipedrive_deal_${deal.id}`,
            vector: embeddings[index],
            metadata: cleanMetadata({
                type: 'deal',
                source: 'pipedrive',
                customerId: integration.customer_id.toString(),
                customerName: integration.customer_name,
                dealId: deal.id.toString(),
                title: deal.title || '',
                value: (deal.value || 0).toString(),
                currency: deal.currency || '',
                status: deal.status || '',
                stageId: deal.stage_id ? deal.stage_id.toString() : '',
                organizationId: deal.org_id ? deal.org_id.toString() : '',
                organizationName: deal.org_name || '',
                personId: deal.person_id ? deal.person_id.toString() : '',
                personName: deal.person_name || '',
                ownerId: deal.owner_id ? deal.owner_id.toString() : '',
                expectedCloseDate: deal.expected_close_date || '',
                addTime: deal.add_time || '',
                updateTime: deal.update_time || '',
                closeTime: deal.close_time || '',
                lostReason: deal.lost_reason || '',
                visibleTo: deal.visible_to || '',
                activeFlag: !!deal.active
            })
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
            metadata: cleanMetadata({
                type: 'lead',
                source: 'pipedrive',
                customerId: integration.customer_id.toString(),
                customerName: integration.customer_name,
                leadId: lead.id.toString(),
                title: lead.title || '',
                value: lead.value?.amount ? lead.value.amount.toString() : '0',
                currency: lead.value?.currency || '',
                ownerId: lead.owner_id ? lead.owner_id.toString() : '',
                personId: lead.person_id ? lead.person_id.toString() : '',
                organizationId: lead.organization_id ? lead.organization_id.toString() : '',
                personName: lead.person_name || '',
                organizationName: lead.organization_name || '',
                expectedCloseDate: lead.expected_close_date || '',
                addTime: lead.add_time || '',
                updateTime: lead.update_time || '',
                status: lead.status || '',
                source: lead.source_name || '',
                notes: lead.note || '',
                labelIds: Array.isArray(lead.label_ids) ? lead.label_ids.join(', ') : ''
            })
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
            metadata: cleanMetadata({
                type: 'activity',
                source: 'pipedrive',
                customerId: integration.customer_id.toString(),
                customerName: integration.customer_name,
                activityId: activity.id.toString(),
                subject: activity.subject || '',
                type: activity.type || '',
                dueDate: activity.due_date || '',
                dueTime: activity.due_time || '',
                duration: activity.duration || '',
                dealId: activity.deal_id ? activity.deal_id.toString() : '',
                personId: activity.person_id ? activity.person_id.toString() : '',
                organizationId: activity.org_id ? activity.org_id.toString() : '',
                note: activity.note || '',
                publicDescription: activity.public_description || '',
                location: activity.location || '',
                done: !!activity.done,
                markedAsDoneTime: activity.marked_as_done_time || '',
                activeFlag: !!activity.active_flag,
                userId: activity.user_id ? activity.user_id.toString() : '',
                addTime: activity.add_time || '',
                updateTime: activity.update_time || ''
            })
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

        const peopleTexts = people.map(person => this.createPersonText(person));
        const embeddings = await this.embeddingService.createBatchEmbeddings(peopleTexts);
        
        return people.map((person, index) => ({
            id: `pipedrive_person_${person.id}`,
            vector: embeddings[index],
            metadata: cleanMetadata({
                type: 'person',
                source: 'pipedrive',
                customerId: integration.customer_id.toString(),
                customerName: integration.customer_name,
                personId: person.id.toString(),
                name: person.name || '',
                firstName: person.first_name || '',
                lastName: person.last_name || '',
                email: Array.isArray(person.email) ? person.email.map(e => e.value).join(', ') : person.email || '',
                phone: Array.isArray(person.phone) ? person.phone.map(p => p.value).join(', ') : person.phone || '',
                organizationId: person.org_id ? person.org_id.toString() : '',
                organizationName: person.org_name || '',
                title: person.title || '',
                visibleTo: person.visible_to || '',
                ownerId: person.owner_id ? person.owner_id.toString() : '',
                labels: Array.isArray(person.labels) ? person.labels.join(', ') : '',
                openDealsCount: (person.open_deals_count || '0').toString(),
                wonDealsCount: (person.won_deals_count || '0').toString(),
                lostDealsCount: (person.lost_deals_count || '0').toString(),
                lastActivityDate: person.last_activity_date || '',
                nextActivityDate: person.next_activity_date || '',
                addTime: person.add_time || '',
                updateTime: person.update_time || '',
                activeFlag: !!person.active_flag
            })
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
            metadata: cleanMetadata({
                type: 'note',
                source: 'pipedrive',
                customerId: integration.customer_id.toString(),
                customerName: integration.customer_name,
                noteId: note.id.toString(),
                content: note.content || '',
                dealId: note.deal_id ? note.deal_id.toString() : '',
                personId: note.person_id ? note.person_id.toString() : '',
                organizationId: note.org_id ? note.org_id.toString() : '',
                userId: note.user_id ? note.user_id.toString() : '',
                addTime: note.add_time || '',
                updateTime: note.update_time || '',
                activeFlag: !!note.active_flag,
                pinnedToDeal: !!note.pinned_to_deal_flag,
                pinnedToOrganization: !!note.pinned_to_organization_flag,
                pinnedToPerson: !!note.pinned_to_person_flag,
                lastUpdateUserId: note.last_update_user_id ? note.last_update_user_id.toString() : ''
            })
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
            metadata: cleanMetadata({
                type: 'organization',
                source: 'pipedrive',
                customerId: integration.customer_id.toString(),
                customerName: integration.customer_name,
                organizationId: org.id.toString(),
                name: org.name || '',
                address: org.address || '',
                addressCountry: org.address_country || '',
                addressLocality: org.address_locality || '',
                addressPostalCode: org.address_postal_code || '',
                ownerId: org.owner_id ? org.owner_id.toString() : '',
                activeFlag: !!org.active_flag,
                visibleTo: org.visible_to || '',
                email: Array.isArray(org.email) ? org.email.map(e => e.value).join(', ') : org.email || '',
                phone: Array.isArray(org.phone) ? org.phone.map(p => p.value).join(', ') : org.phone || '',
                webDomain: org.web_domain || '',
                addTime: org.add_time || '',
                updateTime: org.update_time || '',
                labels: Array.isArray(org.labels) ? org.labels.join(', ') : '',
                openDealsCount: (org.open_deals_count || '0').toString(),
                wonDealsCount: (org.won_deals_count || '0').toString(),
                lostDealsCount: (org.lost_deals_count || '0').toString(),
                lastActivityDate: org.last_activity_date || '',
                nextActivityDate: org.next_activity_date || ''
            })
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