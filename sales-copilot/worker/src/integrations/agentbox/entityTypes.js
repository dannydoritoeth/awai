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
    },
    {
        name: 'enquiry',
        description: 'Property enquiries from potential buyers/renters',
        fields: [
            {
                name: 'id',
                type: 'string',
                description: 'Unique identifier for the enquiry'
            },
            {
                name: 'comment',
                type: 'string',
                description: 'The enquiry message content'
            },
            {
                name: 'date',
                type: 'datetime',
                description: 'When the enquiry was made'
            },
            {
                name: 'type',
                type: 'string',
                description: 'Type of enquiry (e.g., Buyer Enquiry)'
            },
            {
                name: 'origin',
                type: 'string',
                description: 'Source of the enquiry'
            },
            {
                name: 'firstCreated',
                type: 'datetime',
                description: 'When the enquiry was first created in the system'
            },
            {
                name: 'lastModified',
                type: 'datetime',
                description: 'When the enquiry was last modified'
            }
        ],
        relationships: [
            {
                name: 'property',
                type: 'property',
                description: 'The property this enquiry is about'
            },
            {
                name: 'contact',
                type: 'contact',
                description: 'The contact who made the enquiry'
            }
        ],
        aiCapabilities: [
            {
                name: 'intent_classification',
                description: 'Classify enquiry intent (inspection, pricing, documentation, etc.)'
            },
            {
                name: 'priority_scoring',
                description: 'Score enquiry priority based on content and context'
            },
            {
                name: 'response_suggestion',
                description: 'Suggest appropriate responses based on enquiry type and content'
            },
            {
                name: 'feature_extraction',
                description: 'Extract key property features of interest from enquiry text'
            },
            {
                name: 'sentiment_analysis',
                description: 'Analyze enquiry sentiment and urgency'
            }
        ]
    },
    {
        name: 'prospective_buyer',
        description: 'Potential property buyers with their engagement history and status',
        fields: [
            {
                name: 'id',
                type: 'string',
                description: 'Unique identifier for the prospective buyer'
            },
            {
                name: 'enquirySource',
                type: 'string',
                description: 'Source of the initial enquiry'
            },
            {
                name: 'interestLevel',
                type: 'string',
                description: 'Level of interest (e.g., Warm, Hot, Cold)'
            },
            {
                name: 'priceFeedback',
                type: 'number',
                description: 'Price feedback provided by the buyer'
            },
            {
                name: 'totalEnquiries',
                type: 'number',
                description: 'Total number of enquiries made'
            },
            {
                name: 'totalInspections',
                type: 'number',
                description: 'Total number of property inspections'
            },
            {
                name: 'totalOffers',
                type: 'number',
                description: 'Total number of offers made'
            },
            {
                name: 'totalNotes',
                type: 'number',
                description: 'Total number of notes recorded'
            },
            {
                name: 'contractTaken',
                type: 'boolean',
                description: 'Whether a contract has been taken'
            },
            {
                name: 'reportTaken',
                type: 'boolean',
                description: 'Whether a property report has been taken'
            },
            {
                name: 'ongoingInterest',
                type: 'boolean',
                description: 'Whether there is ongoing interest'
            },
            {
                name: 'followUp',
                type: 'boolean',
                description: 'Whether follow-up is required'
            },
            {
                name: 'firstActivityDate',
                type: 'datetime',
                description: 'Date of first activity'
            },
            {
                name: 'lastActivityDate',
                type: 'datetime',
                description: 'Date of most recent activity'
            }
        ],
        relationships: [
            {
                name: 'enquiries',
                type: 'enquiry',
                description: 'Related property enquiries'
            },
            {
                name: 'properties',
                type: 'property',
                description: 'Properties of interest'
            },
            {
                name: 'contact',
                type: 'contact',
                description: 'Associated contact record'
            }
        ],
        aiCapabilities: [
            {
                name: 'engagement_scoring',
                description: 'Calculate buyer engagement level based on activity history'
            },
            {
                name: 'buyer_stage_analysis',
                description: 'Determine buyer stage in purchase journey'
            },
            {
                name: 'activity_pattern_recognition',
                description: 'Identify patterns in buyer activity and engagement'
            },
            {
                name: 'next_action_prediction',
                description: 'Predict and suggest next best actions'
            },
            {
                name: 'conversion_probability',
                description: 'Calculate probability of conversion based on engagement metrics'
            },
            {
                name: 'price_sensitivity_analysis',
                description: 'Analyze price feedback and offer history'
            },
            {
                name: 'engagement_trend_analysis',
                description: 'Track and analyze changes in engagement over time'
            },
            {
                name: 'follow_up_prioritization',
                description: 'Prioritize follow-up actions based on engagement and status'
            }
        ]
    }
];

module.exports = {
    entityTypes,
    processContacts,
    processListings,
    processStaff
}; 