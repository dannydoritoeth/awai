const AgentboxClient = require('./client');
const dbHelper = require('../../services/dbHelper');

class AgentboxIntegration {
    constructor(pineconeService, embeddingService) {
        this.pineconeService = pineconeService;
        this.embeddingService = embeddingService;
    }

    async process(integration) {
        let syncId = null;
        try {
            console.log(`Processing Agentbox integration for customer ${integration.customer_id} (${integration.customer_name})`);
            
            syncId = await this.createSyncRecord(integration.id);
            
            // Process contacts
            const contacts = await this.fetchContacts(integration);
            
            if (contacts.length === 0) {
                console.log('No data found to process');
                return;
            }

            // Create and store vectors for contacts
            const contactVectors = await this.createContactVectors(contacts, integration);
            await this.storeVectors(contactVectors);

            await this.updateSyncStatus(syncId, contacts.length, integration.id);

            console.log(
                `Successfully processed ${contacts.length} contacts ` +
                `for customer ${integration.customer_id}`
            );
        } catch (error) {
            console.error(`Error processing Agentbox integration for customer ${integration.customer_id}:`, error);
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

    async fetchContacts(integration) {
        const client = new AgentboxClient(integration.connection_settings);
        console.log('Fetching contacts from Agentbox...');
        const contacts = await client.getAllContacts();
        console.log(`Found ${contacts.length} contacts to process`);
        return contacts;
    }

    async createContactVectors(contacts, integration) {
        if (contacts.length === 0) return [];

        console.log('Creating contact texts for embedding...');
        const contactTexts = contacts.map(contact => this.createContactText(contact));
        
        console.log('Getting contact embeddings from OpenAI...');
        const embeddings = await this.embeddingService.createBatchEmbeddings(contactTexts);
        console.log(`Created ${embeddings.length} contact embeddings`);
        
        console.log('Creating contact vectors for Pinecone...');
        return contacts.map((contact, index) => ({
            id: `agentbox_contact_${contact.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'contact',
                source: 'agentbox',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                contactId: contact.id,
                firstName: contact.firstName || '',
                lastName: contact.lastName || '',
                email: contact.email || '',
                mobile: contact.mobile || '',
                homePhone: contact.homePhone || '',
                workPhone: contact.workPhone || '',
                status: contact.status || '',
                type: contact.type || '',
                jobTitle: contact.jobTitle || '',
                companyName: contact.companyName || '',
                website: contact.website || '',
                source: contact.source || '',
                firstCreated: contact.firstCreated || '',
                lastModified: contact.lastModified || ''
            }
        }));
    }

    createContactText(contact) {
        const parts = [
            `Name: ${[contact.firstName, contact.lastName].filter(Boolean).join(' ')}`,
            contact.jobTitle ? `Job Title: ${contact.jobTitle}` : null,
            contact.companyName ? `Company: ${contact.companyName}` : null,
            contact.email ? `Email: ${contact.email}` : null,
            contact.mobile ? `Mobile: ${contact.mobile}` : null,
            contact.homePhone ? `Home Phone: ${contact.homePhone}` : null,
            contact.workPhone ? `Work Phone: ${contact.workPhone}` : null,
            contact.website ? `Website: ${contact.website}` : null,
            `Status: ${contact.status}`,
            `Type: ${contact.type}`,
            `Source: ${contact.source}`
        ];

        return parts.filter(part => part).join('\n');
    }

    async storeVectors(vectors) {
        if (vectors.length === 0) return;

        console.log(`Storing ${vectors.length} vectors in Pinecone...`);
        
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
}

module.exports = AgentboxIntegration; 