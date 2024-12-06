const PipedriveClient = require('./client');
const dbHelper = require('../../services/dbHelper');
const { Document } = require("@langchain/core/documents");
const { LangchainPineconeService, LOG_LEVELS } = require('../../services/langchainPineconeService');
const LangchainEmbeddingAdapter = require('../../services/langchainEmbeddingAdapter');

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
    constructor(embeddingService, pineconeService, testMode = false, testLimit = 3, logLevel = LOG_LEVELS.INFO) {
        this.embeddingService = embeddingService;
        this.pineconeService = pineconeService;
        this.testMode = testMode;
        this.testLimit = testLimit;
        this.logLevel = logLevel;
        
        const embeddingAdapter = new LangchainEmbeddingAdapter(embeddingService);
        this.langchainPinecone = new LangchainPineconeService(
            process.env.PINECONE_API_KEY,
            embeddingAdapter,
            logLevel
        );
    }

    log(level, message, data = null) {
        if (level <= this.logLevel) {
            switch (level) {
                case LOG_LEVELS.ERROR:
                    console.error(message, data || '');
                    break;
                case LOG_LEVELS.INFO:
                    console.log(message, data ? `(${JSON.stringify(data)})` : '');
                    break;
                case LOG_LEVELS.DEBUG:
                    console.log('DEBUG:', message, data || '');
                    break;
            }
        }
    }

    async process(integration) {
        let syncId = null;
        try {
            this.log(LOG_LEVELS.INFO, `Processing Pipedrive integration`, {
                customerId: integration.customer_id,
                customerName: integration.customer_name
            });
            
            syncId = await this.createSyncRecord(integration.id);
            
            // Process each entity type
            const entityTypes = [
                { name: 'deals', fetch: this.fetchDeals.bind(this), create: this.createDealVectors.bind(this) },
                { name: 'leads', fetch: this.fetchLeads.bind(this), create: this.createLeadVectors.bind(this) },
                // ... other entity types
            ];

            let totalCount = 0;
            for (const entityType of entityTypes) {
                const items = await entityType.fetch(integration);
                const vectors = await entityType.create(items, integration);
                await this.storeVectors(vectors);
                totalCount += items.length;
                this.log(LOG_LEVELS.INFO, `Processed ${items.length} ${entityType.name}`);
            }

            await this.updateSyncStatus(syncId, totalCount, integration.id);
            this.log(LOG_LEVELS.INFO, `Successfully processed ${totalCount} total records`);
        } catch (error) {
            this.log(LOG_LEVELS.ERROR, `Processing failed`, { error });
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
        const client = new PipedriveClient(integration.connection_settings, this.testMode, this.testLimit);
        this.log(LOG_LEVELS.INFO, 'Fetching deals from Pipedrive...');
        const deals = await client.getAllDeals();
        this.log(LOG_LEVELS.INFO, `Found ${deals.length} deals to process`);
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Sample deal:', deals[0]);
        }
        return deals;
    }

    async fetchLeads(integration) {
        const client = new PipedriveClient(integration.connection_settings);
        this.log(LOG_LEVELS.INFO, 'Fetching leads from Pipedrive...');
        const leads = await client.getAllLeads();
        this.log(LOG_LEVELS.INFO, `Found ${leads.length} leads to process`);
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Sample lead:', leads[0]);
        }
        return leads;
    }

    async fetchActivities(integration) {
        const client = new PipedriveClient(integration.connection_settings);
        this.log(LOG_LEVELS.INFO, 'Fetching activities from Pipedrive...');
        const activities = await client.getAllActivities();
        this.log(LOG_LEVELS.INFO, `Found ${activities.length} activities to process`);
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Sample activity:', activities[0]);
        }
        return activities;
    }

    async fetchPeople(integration) {
        const client = new PipedriveClient(integration.connection_settings);
        this.log(LOG_LEVELS.INFO, 'Fetching people from Pipedrive...');
        const people = await client.getAllPeople();
        this.log(LOG_LEVELS.INFO, `Found ${people.length} people to process`);
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Sample person:', people[0]);
        }
        return people;
    }

    async fetchNotes(integration) {
        const client = new PipedriveClient(integration.connection_settings);
        this.log(LOG_LEVELS.INFO, 'Fetching notes from Pipedrive...');
        const notes = await client.getAllNotes();
        this.log(LOG_LEVELS.INFO, `Found ${notes.length} notes to process`);
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Sample note:', notes[0]);
        }
        return notes;
    }

    async fetchOrganizations(integration) {
        const client = new PipedriveClient(integration.connection_settings);
        this.log(LOG_LEVELS.INFO, 'Fetching organizations from Pipedrive...');
        const organizations = await client.getAllOrganizations();
        this.log(LOG_LEVELS.INFO, `Found ${organizations.length} organizations to process`);
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Sample organization:', organizations[0]);
        }
        return organizations;
    }

    async createDealVectors(deals, integration) {
        if (deals.length === 0) return [];

        this.log(LOG_LEVELS.INFO, `Creating vectors for ${deals.length} deals`);
        const dealTexts = deals.map(deal => this.createDealText(deal));
        const embeddings = await this.embeddingService.createBatchEmbeddings(dealTexts);
        
        const vectors = deals.map((deal, index) => {
            const metadata = {
                type: 'deal',
                source: 'pipedrive',
                customerId: integration.customer_id.toString(),
                customerName: integration.customer_name,
                dealId: deal.id?.toString() || '',
                title: deal.title || '',
                value: (deal.value || 0).toString(),
                currency: deal.currency || '',
                status: deal.status || '',
                stageId: deal.stage_id?.toString() || '',
                organizationId: typeof deal.org_id === 'object' ? deal.org_id?.value?.toString() || '' : deal.org_id?.toString() || '',
                organizationName: deal.org_name || '',
                personId: typeof deal.person_id === 'object' ? deal.person_id?.value?.toString() || '' : deal.person_id?.toString() || '',
                personName: deal.person_name || '',
                ownerId: deal.owner_id?.toString() || '',
                expectedCloseDate: deal.expected_close_date || '',
                addTime: deal.add_time || '',
                updateTime: deal.update_time || '',
                closeTime: deal.close_time || '',
                lostReason: deal.lost_reason || '',
                visibleTo: deal.visible_to || '',
                activeFlag: !!deal.active,
                rawData: JSON.stringify(deal)
            };

            const doc = new Document({
                pageContent: this.createDealText(deal),
                metadata
            });

            return {
                id: `pipedrive_deal_${deal.id}`,
                values: embeddings[index],
                metadata: doc.metadata
            };
        });

        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Sample vector:', {
                id: vectors[0].id,
                metadataKeys: Object.keys(vectors[0].metadata)
            });
        }

        return vectors;
    }

    createDealText(deal) {
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Creating deal text for:', deal.title);
        }

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

        const text = parts.filter(part => part).join('\n');
        
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Generated deal text:', text);
        }
        
        return text;
    }

    async createLeadVectors(leads, integration) {
        if (leads.length === 0) return [];

        this.log(LOG_LEVELS.INFO, `Creating vectors for ${leads.length} leads`);
        const leadTexts = leads.map(lead => this.createLeadText(lead));
        const embeddings = await this.embeddingService.createBatchEmbeddings(leadTexts);
        
        const vectors = leads.map((lead, index) => {
            const metadata = {
                type: 'lead',
                source: 'pipedrive',
                customerId: integration.customer_id.toString(),
                customerName: integration.customer_name,
                leadId: lead.id?.toString() || '',
                title: lead.title || '',
                value: lead.value?.amount ? lead.value.amount.toString() : '0',
                currency: lead.value?.currency || '',
                ownerId: typeof lead.owner_id === 'object' ? lead.owner_id?.value?.toString() || '' : lead.owner_id?.toString() || '',
                personId: typeof lead.person_id === 'object' ? lead.person_id?.value?.toString() || '' : lead.person_id?.toString() || '',
                organizationId: typeof lead.organization_id === 'object' ? lead.organization_id?.value?.toString() || '' : lead.organization_id?.toString() || '',
                personName: lead.person_name || '',
                organizationName: lead.organization_name || '',
                expectedCloseDate: lead.expected_close_date || '',
                addTime: lead.add_time || '',
                updateTime: lead.update_time || '',
                status: lead.status || '',
                source: lead.source_name || '',
                notes: lead.note || '',
                labelIds: Array.isArray(lead.label_ids) ? lead.label_ids.join(', ') : '',
                rawData: JSON.stringify(lead)
            };

            const doc = new Document({
                pageContent: this.createLeadText(lead),
                metadata
            });

            return {
                id: `pipedrive_lead_${lead.id}`,
                values: embeddings[index],
                metadata: doc.metadata
            };
        });

        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Sample vector:', {
                id: vectors[0].id,
                metadataKeys: Object.keys(vectors[0].metadata)
            });
        }

        return vectors;
    }

    createLeadText(lead) {
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Creating lead text for:', lead.title);
        }

        const parts = [
            `Title: ${lead.title}`,
            `Person: ${lead.person_name || 'Unknown'}`,
            `Organization: ${lead.organization_name || 'Unknown'}`,
            `Value: ${lead.value?.amount || 0} ${lead.value?.currency || ''}`,
            `Source: ${lead.source_name || 'Unknown'}`,
            `Status: ${lead.status || 'Unknown'}`,
            `Notes: ${lead.note || ''}`
        ];

        const text = parts.filter(part => part).join('\n');
        
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Generated lead text:', text);
        }
        
        return text;
    }

    async createActivityVectors(activities, integration) {
        if (activities.length === 0) return [];

        const activityTexts = activities.map(activity => this.createActivityText(activity));
        const embeddings = await this.embeddingService.createBatchEmbeddings(activityTexts);
        
        return activities.map((activity, index) => {
            const metadata = {
                type: 'activity',
                source: 'pipedrive',
                customerId: integration.customer_id.toString(),
                customerName: integration.customer_name,
                activityId: activity.id?.toString() || '',
                subject: activity.subject || '',
                type: activity.type || '',
                dueDate: activity.due_date || '',
                dueTime: activity.due_time || '',
                duration: activity.duration || '',
                dealId: typeof activity.deal_id === 'object' ? activity.deal_id?.value?.toString() || '' : activity.deal_id?.toString() || '',
                personId: typeof activity.person_id === 'object' ? activity.person_id?.value?.toString() || '' : activity.person_id?.toString() || '',
                organizationId: typeof activity.org_id === 'object' ? activity.org_id?.value?.toString() || '' : activity.org_id?.toString() || '',
                note: activity.note || '',
                publicDescription: activity.public_description || '',
                location: activity.location || '',
                done: !!activity.done,
                markedAsDoneTime: activity.marked_as_done_time || '',
                activeFlag: !!activity.active_flag,
                userId: typeof activity.user_id === 'object' ? activity.user_id?.value?.toString() || '' : activity.user_id?.toString() || '',
                addTime: activity.add_time || '',
                updateTime: activity.update_time || '',
                rawData: JSON.stringify(activity)
            };

            const doc = new Document({
                pageContent: this.createActivityText(activity),
                metadata
            });

            return {
                id: `pipedrive_activity_${activity.id}`,
                values: embeddings[index],
                metadata: doc.metadata
            };
        });
    }

    createActivityText(activity) {
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Creating activity text for:', activity.subject);
        }

        const parts = [
            `Subject: ${activity.subject || ''}`,
            `Type: ${activity.type || ''}`,
            `Due: ${activity.due_date || ''} ${activity.due_time || ''}`,
            `Status: ${activity.done ? 'Done' : 'Active'}`,
            activity.note ? `Note: ${activity.note}` : null,
            activity.public_description ? `Description: ${activity.public_description}` : null,
            activity.location ? `Location: ${activity.location}` : null
        ];

        const text = parts.filter(part => part).join('\n');
        
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Generated activity text:', text);
        }
        
        return text;
    }

    async createPeopleVectors(people, integration) {
        if (people.length === 0) return [];

        const peopleTexts = people.map(person => this.createPersonText(person));
        const embeddings = await this.embeddingService.createBatchEmbeddings(peopleTexts);
        
        return people.map((person, index) => {
            const metadata = {
                type: 'person',
                source: 'pipedrive',
                customerId: integration.customer_id.toString(),
                customerName: integration.customer_name,
                personId: person.id?.toString() || '',
                name: person.name || '',
                firstName: person.first_name || '',
                lastName: person.last_name || '',
                email: Array.isArray(person.email) ? person.email.map(e => e.value).join(', ') : person.email || '',
                phone: Array.isArray(person.phone) ? person.phone.map(p => p.value).join(', ') : person.phone || '',
                organizationId: typeof person.org_id === 'object' ? person.org_id?.value?.toString() || '' : person.org_id?.toString() || '',
                organizationName: person.org_name || '',
                title: person.title || '',
                visibleTo: person.visible_to || '',
                ownerId: typeof person.owner_id === 'object' ? person.owner_id?.value?.toString() || '' : person.owner_id?.toString() || '',
                labels: Array.isArray(person.labels) ? person.labels.join(', ') : '',
                openDealsCount: (person.open_deals_count || '0').toString(),
                wonDealsCount: (person.won_deals_count || '0').toString(),
                lostDealsCount: (person.lost_deals_count || '0').toString(),
                lastActivityDate: person.last_activity_date || '',
                nextActivityDate: person.next_activity_date || '',
                addTime: person.add_time || '',
                updateTime: person.update_time || '',
                activeFlag: !!person.active_flag,
                rawData: JSON.stringify(person)
            };

            const doc = new Document({
                pageContent: this.createPersonText(person),
                metadata
            });

            return {
                id: `pipedrive_person_${person.id}`,
                values: embeddings[index],
                metadata: doc.metadata
            };
        });
    }

    createPersonText(person) {
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Creating person text for:', person.name);
        }

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

        const text = parts.filter(part => part).join('\n');
        
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Generated person text:', text);
        }
        
        return text;
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

    async storeVectors(vectors, useLangChain = true) {
        if (vectors.length === 0) return;

        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, '=== Starting Vector Storage ===');
            this.log(LOG_LEVELS.DEBUG, 'First vector sample:', {
                id: vectors[0].id,
                metadata: {
                    type: vectors[0].metadata.type,
                    source: vectors[0].metadata.source,
                    customerId: vectors[0].metadata.customerId
                },
                vectorLength: vectors[0].values.length
            });
        }

        this.log(LOG_LEVELS.INFO, `Processing ${vectors.length} vectors`);
        
        const namespace = vectors[0].metadata.customerId.toString();
        this.log(LOG_LEVELS.INFO, `Using namespace: ${namespace}`);
        
        try {
            if (useLangChain) {
                this.log(LOG_LEVELS.INFO, 'Using LangChain Pinecone Service');
                await this.langchainPinecone.addDocuments(vectors, namespace);
            } else {
                this.log(LOG_LEVELS.INFO, 'Using standard Pinecone Service');
                await this.pineconeService.upsertBatch(vectors, namespace);
            }
            
            this.log(LOG_LEVELS.INFO, `Successfully stored ${vectors.length} vectors`);
            
            if (this.logLevel >= LOG_LEVELS.DEBUG) {
                this.log(LOG_LEVELS.DEBUG, '=== Vector Storage Complete ===');
            }
        } catch (error) {
            this.log(LOG_LEVELS.ERROR, 'Error storing vectors:', error);
            throw error;
        }
    }

    async updateSyncStatus(syncId, recordCount, integrationId) {
        this.log(LOG_LEVELS.DEBUG, 'Updating sync status', { syncId, recordCount });
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
        this.log(LOG_LEVELS.DEBUG, 'Sync status updated successfully');
    }

    async updateSyncError(syncId, errorMessage) {
        if (syncId) {
            this.log(LOG_LEVELS.ERROR, 'Updating sync with error', { syncId, errorMessage });
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
        
        return notes.map((note, index) => {
            const metadata = {
                type: 'note',
                source: 'pipedrive',
                customerId: integration.customer_id.toString(),
                customerName: integration.customer_name,
                noteId: note.id?.toString() || '',
                content: note.content || '',
                dealId: typeof note.deal_id === 'object' ? note.deal_id?.value?.toString() || '' : note.deal_id?.toString() || '',
                personId: typeof note.person_id === 'object' ? note.person_id?.value?.toString() || '' : note.person_id?.toString() || '',
                organizationId: typeof note.org_id === 'object' ? note.org_id?.value?.toString() || '' : note.org_id?.toString() || '',
                userId: typeof note.user_id === 'object' ? note.user_id?.value?.toString() || '' : note.user_id?.toString() || '',
                addTime: note.add_time || '',
                updateTime: note.update_time || '',
                activeFlag: !!note.active_flag,
                pinnedToDeal: !!note.pinned_to_deal_flag,
                pinnedToOrganization: !!note.pinned_to_organization_flag,
                pinnedToPerson: !!note.pinned_to_person_flag,
                lastUpdateUserId: typeof note.last_update_user_id === 'object' ? note.last_update_user_id?.value?.toString() || '' : note.last_update_user_id?.toString() || '',
                rawData: JSON.stringify(note)
            };

            const doc = new Document({
                pageContent: this.createNoteText(note),
                metadata
            });

            return {
                id: `pipedrive_note_${note.id}`,
                values: embeddings[index],
                metadata: doc.metadata
            };
        });
    }

    createNoteText(note) {
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Creating note text for note:', note.id);
        }

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

        const text = parts.filter(part => part).join('\n');
        
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Generated note text:', text);
        }
        
        return text;
    }

    async createOrganizationVectors(organizations, integration) {
        if (organizations.length === 0) return [];

        const organizationTexts = organizations.map(org => this.createOrganizationText(org));
        const embeddings = await this.embeddingService.createBatchEmbeddings(organizationTexts);
        
        return organizations.map((org, index) => {
            const metadata = {
                type: 'organization',
                source: 'pipedrive',
                customerId: integration.customer_id.toString(),
                customerName: integration.customer_name,
                organizationId: org.id?.toString() || '',
                name: org.name || '',
                address: org.address || '',
                addressCountry: org.address_country || '',
                addressLocality: org.address_locality || '',
                addressPostalCode: org.address_postal_code || '',
                ownerId: typeof org.owner_id === 'object' ? org.owner_id?.value?.toString() || '' : org.owner_id?.toString() || '',
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
                nextActivityDate: org.next_activity_date || '',
                rawData: JSON.stringify(org)
            };

            const doc = new Document({
                pageContent: this.createOrganizationText(org),
                metadata
            });

            return {
                id: `pipedrive_organization_${org.id}`,
                values: embeddings[index],
                metadata: doc.metadata
            };
        });
    }

    createOrganizationText(org) {
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Creating organization text for:', org.name);
        }

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

        const text = parts.filter(part => part).join('\n');
        
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Generated organization text:', text);
        }
        
        return text;
    }
}

module.exports = PipedriveIntegration; 