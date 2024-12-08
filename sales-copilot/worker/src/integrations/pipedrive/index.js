const PipedriveClient = require('./client');
const dbHelper = require('../../services/dbHelper');
const { Document } = require("@langchain/core/documents");
const { LangchainPineconeService, LOG_LEVELS } = require('../../services/langchainPineconeService');
const LangchainEmbeddingAdapter = require('../../services/langchainEmbeddingAdapter');
const PipedriveDocumentCreator = require('./documentCreator');

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
                { name: 'activities', fetch: this.fetchActivities.bind(this), create: this.createActivityVectors.bind(this) },
                { name: 'people', fetch: this.fetchPeople.bind(this), create: this.createPeopleVectors.bind(this) },
                { name: 'notes', fetch: this.fetchNotes.bind(this), create: this.createNoteVectors.bind(this) },
                { name: 'organizations', fetch: this.fetchOrganizations.bind(this), create: this.createOrganizationVectors.bind(this) }
            ];

            let totalCount = 0;
            for (const entityType of entityTypes) {
                this.log(LOG_LEVELS.INFO, `Processing ${entityType.name}...`);
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
        
        // Create LangChain Documents
        const documents = deals.map(deal => {
            const text = this.createDealText(deal);
            return new Document({
                pageContent: text,
                metadata: {
                    type: 'deal',
                    source: 'pipedrive',
                    customerId: integration.customer_id.toString(),
                    customerName: integration.customer_name,
                    dealId: deal.id?.toString() || '',
                    rawData: JSON.stringify(deal)
                }
            });
        });

        // Let LangChain handle the embedding and storage
        await this.langchainPinecone.addDocuments(documents, integration.customer_id.toString());
        return documents;
    }

    createDealText(deal) {
        if (this.logLevel >= LOG_LEVELS.DEBUG) {
            this.log(LOG_LEVELS.DEBUG, 'Creating deal text for:', deal.title);
        }

        const parts = [
            `Title: ${deal.title}`,
            `Person: ${deal.person_name || 'Unknown'}`,
            `Organization: ${deal.organization_name || 'Unknown'}`,
            `Value: ${deal.value?.amount || 0} ${deal.value?.currency || ''}`,
            `Source: ${deal.source_name || 'Unknown'}`,
            `Status: ${deal.status || 'Unknown'}`,
            `Notes: ${deal.note || ''}`
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
        
        // Create LangChain Documents
        const documents = leads.map(lead => {
            const text = this.createLeadText(lead);
            return new Document({
                pageContent: text,
                metadata: {
                    type: 'lead',
                    source: 'pipedrive',
                    customerId: integration.customer_id.toString(),
                    customerName: integration.customer_name,
                    leadId: lead.id?.toString() || '',
                    rawData: JSON.stringify(lead)
                }
            });
        });

        // Let LangChain handle the embedding and storage
        await this.langchainPinecone.addDocuments(documents, integration.customer_id.toString());
        return documents;
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

        this.log(LOG_LEVELS.INFO, `Creating vectors for ${activities.length} activities`);
        
        const documents = activities.map(activity => {
            const text = this.createActivityText(activity);
            return new Document({
                pageContent: text,
                metadata: {
                    type: 'activity',
                    source: 'pipedrive',
                    customerId: integration.customer_id.toString(),
                    customerName: integration.customer_name,
                    activityId: activity.id?.toString() || '',
                    rawData: JSON.stringify(activity)
                }
            });
        });

        await this.langchainPinecone.addDocuments(documents, integration.customer_id.toString());
        return documents;
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

        this.log(LOG_LEVELS.INFO, `Creating vectors for ${people.length} people`);
        
        const documents = people.map(person => {
            const text = this.createPersonText(person);
            return new Document({
                pageContent: text,
                metadata: {
                    type: 'person',
                    source: 'pipedrive',
                    customerId: integration.customer_id.toString(),
                    customerName: integration.customer_name,
                    personId: person.id?.toString() || '',
                    rawData: JSON.stringify(person)
                }
            });
        });

        await this.langchainPinecone.addDocuments(documents, integration.customer_id.toString());
        return documents;
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

        this.log(LOG_LEVELS.INFO, `Creating vectors for ${notes.length} notes`);
        
        const documents = notes.map(note => {
            const text = this.createNoteText(note);
            return new Document({
                pageContent: text,
                metadata: {
                    type: 'note',
                    source: 'pipedrive',
                    customerId: integration.customer_id.toString(),
                    customerName: integration.customer_name,
                    noteId: note.id?.toString() || '',
                    rawData: JSON.stringify(note)
                }
            });
        });

        await this.langchainPinecone.addDocuments(documents, integration.customer_id.toString());
        return documents;
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

        this.log(LOG_LEVELS.INFO, `Creating vectors for ${organizations.length} organizations`);
        
        const documents = organizations.map(org => {
            const text = this.createOrganizationText(org);
            return new Document({
                pageContent: text,
                metadata: {
                    type: 'organization',
                    source: 'pipedrive',
                    customerId: integration.customer_id.toString(),
                    customerName: integration.customer_name,
                    organizationId: org.id?.toString() || '',
                    rawData: JSON.stringify(org)
                }
            });
        });

        await this.langchainPinecone.addDocuments(documents, integration.customer_id.toString());
        return documents;
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