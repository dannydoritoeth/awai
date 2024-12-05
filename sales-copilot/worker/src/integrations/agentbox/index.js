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
            
            // Process all entity types
            const [contacts, listings, staff] = await Promise.all([
                this.fetchContacts(integration),
                this.fetchListings(integration),
                this.fetchStaff(integration)
            ]);
            
            if (contacts.length === 0 && listings.length === 0 && staff.length === 0) {
                console.log('No data found to process');
                return;
            }

            // Create and store vectors for all types
            const contactVectors = await this.createContactVectors(contacts, integration);
            const listingVectors = await this.createListingVectors(listings, integration);
            const staffVectors = await this.createStaffVectors(staff, integration);
            
            await this.storeVectors([
                ...contactVectors, 
                ...listingVectors,
                ...staffVectors
            ]);

            const totalCount = contacts.length + listings.length + staff.length;
            await this.updateSyncStatus(syncId, totalCount, integration.id);

            console.log(
                `Successfully processed ${contacts.length} contacts, ` +
                `${listings.length} listings, and ${staff.length} staff members ` +
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

    async fetchListings(integration) {
        const client = new AgentboxClient(integration.connection_settings);
        console.log('Fetching listings from Agentbox...');
        const listings = await client.getAllListings();
        console.log(`Found ${listings.length} listings to process`);
        return listings;
    }

    async fetchStaff(integration) {
        const client = new AgentboxClient(integration.connection_settings);
        console.log('Fetching staff from Agentbox...');
        const staff = await client.getAllStaff();
        console.log(`Found ${staff.length} staff members to process`);
        return staff;
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

    async createListingVectors(listings, integration) {
        if (listings.length === 0) return [];

        console.log('Creating listing texts for embedding...');
        const listingTexts = listings.map(listing => this.createListingText(listing));
        
        console.log('Getting listing embeddings from OpenAI...');
        const embeddings = await this.embeddingService.createBatchEmbeddings(listingTexts);
        console.log(`Created ${embeddings.length} listing embeddings`);
        
        console.log('Creating listing vectors for Pinecone...');
        return listings.map((listing, index) => ({
            id: `agentbox_listing_${listing.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'listing',
                source: 'agentbox',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                listingId: listing.id,
                propertyId: listing.property?.id,
                listingType: listing.type,
                status: listing.status,
                marketingStatus: listing.marketingStatus,
                displayPrice: listing.displayPrice,
                headline: listing.mainHeadline,
                propertyType: listing.property?.type,
                propertyCategory: listing.property?.category,
                bedrooms: listing.property?.bedrooms,
                bathrooms: listing.property?.bathrooms,
                parking: listing.property?.totalParking,
                suburb: listing.property?.address?.suburb,
                state: listing.property?.address?.state,
                postcode: listing.property?.address?.postcode,
                region: listing.property?.address?.region,
                streetAddress: listing.property?.address?.streetAddress,
                latitude: listing.property?.location?.lat,
                longitude: listing.property?.location?.long,
                firstCreated: listing.firstCreated,
                lastModified: listing.lastModified
            }
        }));
    }

    async createStaffVectors(staffMembers, integration) {
        if (staffMembers.length === 0) return [];

        console.log('Creating staff texts for embedding...');
        const staffTexts = staffMembers.map(staff => this.createStaffText(staff));
        
        console.log('Getting staff embeddings from OpenAI...');
        const embeddings = await this.embeddingService.createBatchEmbeddings(staffTexts);
        console.log(`Created ${embeddings.length} staff embeddings`);
        
        console.log('Creating staff vectors for Pinecone...');
        return staffMembers.map((staff, index) => ({
            id: `agentbox_staff_${staff.id}`,
            vector: embeddings[index],
            metadata: {
                type: 'staff',
                source: 'agentbox',
                customerId: integration.customer_id,
                customerName: integration.customer_name,
                staffId: staff.id,
                firstName: staff.firstName || '',
                lastName: staff.lastName || '',
                email: staff.email || '',
                mobile: staff.mobile || '',
                phone: staff.phone || '',
                status: staff.status || '',
                role: staff.role || '',
                jobTitle: staff.jobTitle || '',
                officeId: staff.officeId || '',
                officeName: staff.officeName || '',
                firstCreated: staff.firstCreated || '',
                lastModified: staff.lastModified || '',
                hideMobileOnWeb: staff.hideMobileOnWeb || false
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

    createListingText(listing) {
        const parts = [
            `Headline: ${listing.mainHeadline}`,
            `Type: ${listing.type}`,
            `Status: ${listing.status}`,
            `Price: ${listing.displayPrice}`,
            listing.property?.type ? `Property Type: ${listing.property.type}` : null,
            listing.property?.category ? `Category: ${listing.property.category}` : null,
            listing.property?.bedrooms ? `Bedrooms: ${listing.property.bedrooms}` : null,
            listing.property?.bathrooms ? `Bathrooms: ${listing.property.bathrooms}` : null,
            listing.property?.totalParking ? `Parking: ${listing.property.totalParking}` : null,
            listing.property?.address ? `Address: ${[
                listing.property.address.streetAddress,
                listing.property.address.suburb,
                listing.property.address.state,
                listing.property.address.postcode
            ].filter(Boolean).join(', ')}` : null,
            listing.property?.address?.region ? `Region: ${listing.property.address.region}` : null
        ];

        return parts.filter(part => part).join('\n');
    }

    createStaffText(staff) {
        const parts = [
            `Name: ${[staff.firstName, staff.lastName].filter(Boolean).join(' ')}`,
            staff.jobTitle ? `Job Title: ${staff.jobTitle}` : null,
            staff.role ? `Role: ${staff.role}` : null,
            staff.email ? `Email: ${staff.email}` : null,
            staff.mobile ? `Mobile: ${staff.mobile}` : null,
            staff.phone ? `Phone: ${staff.phone}` : null,
            staff.officeName ? `Office: ${staff.officeName}` : null,
            `Status: ${staff.status}`,
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