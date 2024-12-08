const AgentboxDocumentCreator = require('./documentCreator');

const createMetadata = (entity, integration, type) => ({
    customerId: integration.customer_id.toString(),
    customerName: integration.customer_name,
    entityId: entity.id,
    type,
    source: 'agentbox',
    createdDate: entity.firstCreated,
    lastModifiedDate: entity.lastModified
});

const createContactMetadata = (contact, integration) => ({
    ...createMetadata(contact, integration, 'contact'),
    contactId: contact.id.toString(),
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    email: contact.email || '',
    mobile: contact.mobile || '',
    status: contact.status || '',
    type: contact.type || '',
    source: contact.source || ''
});

const createListingMetadata = (listing, integration) => ({
    ...createMetadata(listing, integration, 'listing'),
    listingId: listing.id.toString(),
    propertyId: listing.property?.id ? listing.property.id.toString() : '',
    listingType: listing.type || '',
    status: listing.status || '',
    marketingStatus: listing.marketingStatus || '',
    propertyType: listing.property?.type || '',
    propertyCategory: listing.property?.category || '',
    suburb: listing.property?.address?.suburb || '',
    state: listing.property?.address?.state || '',
    postcode: listing.property?.address?.postcode || ''
});

const createStaffMetadata = (staff, integration) => ({
    ...createMetadata(staff, integration, 'staff'),
    staffId: staff.id.toString(),
    firstName: staff.firstName || '',
    lastName: staff.lastName || '',
    email: staff.email || '',
    status: staff.status || '',
    role: staff.role || '',
    officeId: staff.officeId ? staff.officeId.toString() : '',
    officeName: staff.officeName || ''
});

const processContacts = async (client, integration, langchainPinecone, logger) => {
    logger.info('Processing Agentbox contacts...');
    
    const contacts = await client.getAllContacts();
    if (contacts.length === 0) {
        logger.info('No contacts found to process');
        return 0;
    }

    logger.info(`Creating documents for ${contacts.length} contacts`);
    
    const documents = contacts.map(contact => 
        AgentboxDocumentCreator.createDocument(
            contact, 
            'contact',
            createContactMetadata(contact, integration)
        )
    );

    logger.info(`Storing ${documents.length} contact documents in vector database`);
    
    await langchainPinecone.addDocuments(
        documents,
        integration.customer_id.toString()
    );

    logger.info(`Successfully processed ${contacts.length} contacts`);
    return contacts.length;
};

const processListings = async (client, integration, langchainPinecone, logger) => {
    logger.info('Processing Agentbox listings...');
    
    const listings = await client.getAllListings();
    if (listings.length === 0) {
        logger.info('No listings found to process');
        return 0;
    }

    logger.info(`Creating documents for ${listings.length} listings`);
    
    const documents = listings.map(listing => 
        AgentboxDocumentCreator.createDocument(
            listing, 
            'listing',
            createListingMetadata(listing, integration)
        )
    );

    logger.info(`Storing ${documents.length} listing documents in vector database`);
    
    await langchainPinecone.addDocuments(
        documents,
        integration.customer_id.toString()
    );

    logger.info(`Successfully processed ${listings.length} listings`);
    return listings.length;
};

const processStaff = async (client, integration, langchainPinecone, logger) => {
    logger.info('Processing Agentbox staff...');
    
    const staff = await client.getAllStaff();
    if (staff.length === 0) {
        logger.info('No staff found to process');
        return 0;
    }

    logger.info(`Creating documents for ${staff.length} staff members`);
    
    const documents = staff.map(staffMember => 
        AgentboxDocumentCreator.createDocument(
            staffMember, 
            'staff',
            createStaffMetadata(staffMember, integration)
        )
    );

    logger.info(`Storing ${documents.length} staff documents in vector database`);
    
    await langchainPinecone.addDocuments(
        documents,
        integration.customer_id.toString()
    );

    logger.info(`Successfully processed ${staff.length} staff members`);
    return staff.length;
};

const entityTypes = [
    { 
        name: 'contacts',
        process: processContacts
    },
    {
        name: 'listings',
        process: processListings
    },
    {
        name: 'staff',
        process: processStaff
    }
];

module.exports = {
    entityTypes,
    processContacts,
    processListings,
    processStaff
}; 