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

const createInterestLevelMetadata = (interestLevel, integration) => ({
    ...createMetadata(interestLevel, integration, 'interest_level'),
    interestLevelId: interestLevel.id.toString(),
    name: interestLevel.name || ''
});

const createPropertyTypeMetadata = (propertyType, integration) => ({
    ...createMetadata(propertyType, integration, 'property_type'),
    propertyTypeId: propertyType.id.toString(),
    type: propertyType.type || ''
});

const createRegionMetadata = (region, integration) => ({
    ...createMetadata(region, integration, 'region'),
    name: region.name,
    group: region.group,
    state: region.state,
    country: region.country
});

const createEnquirySourceMetadata = (source, integration) => ({
    ...createMetadata(source, integration, 'enquiry_source'),
    sourceId: source.id.toString(),
    name: source.name
});

const createContactClassMetadata = (contactClass, integration) => ({
    ...createMetadata(contactClass, integration, 'contact_class'),
    classId: contactClass.id.toString(),
    name: contactClass.name,
    type: contactClass.type,
    displayName: contactClass.displayName
});

const createContactSourceMetadata = (source, integration) => ({
    ...createMetadata(source, integration, 'contact_source'),
    sourceId: source.id.toString(),
    name: source.name
});

const createOfficeMetadata = (office, integration) => ({
    ...createMetadata(office, integration, 'office'),
    officeId: office.id.toString(),
    name: office.name,
    status: office.status,
    companyName: office.companyName || '',
    tradingName: office.tradingName || '',
    website: office.website || '',
    email: office.email || '',
    phone: office.phone || '',
    franchiseGroup: office.franchiseGroup || '',
    location: office.location ? {
        latitude: office.location.lat,
        longitude: office.location.long
    } : null,
    address: office.address ? {
        streetAddress: office.address.streetAddress,
        suburb: office.address.suburb,
        state: office.address.state,
        postcode: office.address.postcode,
        country: office.address.country
    } : null,
    lastModified: office.lastModified
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

const processInterestLevels = async (client, integration, langchainService, logger) => {
    logger.info('Processing Agentbox interest levels...');
    
    const interestLevels = await client.getEnquiryInterestLevels();
    if (interestLevels.length === 0) {
        logger.info('No interest levels found to process');
        return 0;
    }

    logger.info(`Creating documents for ${interestLevels.length} interest levels`);
    
    const documents = interestLevels.map(level => 
        AgentboxDocumentCreator.createDocument(
            level, 
            'interest_level',
            createInterestLevelMetadata(level, integration)
        )
    );

    await langchainService.addDocuments(
        documents,
        integration.customer_id.toString()
    );

    logger.info(`Successfully processed ${interestLevels.length} interest levels`);
    return interestLevels.length;
};

const processPropertyTypes = async (client, integration, langchainService, logger) => {
    logger.info('Processing Agentbox property types...');
    
    const propertyTypes = await client.getPropertyTypes();
    if (propertyTypes.length === 0) {
        logger.info('No property types found to process');
        return 0;
    }

    logger.info(`Creating documents for ${propertyTypes.length} property types`);
    
    const documents = propertyTypes.map(type => 
        AgentboxDocumentCreator.createDocument(
            type, 
            'property_type',
            createPropertyTypeMetadata(type, integration)
        )
    );

    await langchainService.addDocuments(
        documents,
        integration.customer_id.toString()
    );

    logger.info(`Successfully processed ${propertyTypes.length} property types`);
    return propertyTypes.length;
};

const processRegions = async (client, integration, langchainService, logger) => {
    logger.info('Processing Agentbox regions...');
    
    const regions = await client.getRegions();
    if (regions.length === 0) {
        logger.info('No regions found to process');
        return 0;
    }

    logger.info(`Creating documents for ${regions.length} regions`);
    
    const documents = regions.map(region => 
        AgentboxDocumentCreator.createDocument(
            region, 
            'region',
            createRegionMetadata(region, integration)
        )
    );

    await langchainService.addDocuments(
        documents,
        integration.customer_id.toString()
    );

    logger.info(`Successfully processed ${regions.length} regions`);
    return regions.length;
};

const processEnquirySources = async (client, integration, langchainService, logger) => {
    logger.info('Processing Agentbox enquiry sources...');
    
    const sources = await client.getEnquirySources();
    if (sources.length === 0) {
        logger.info('No enquiry sources found to process');
        return 0;
    }

    logger.info(`Creating documents for ${sources.length} enquiry sources`);
    
    const documents = sources.map(source => 
        AgentboxDocumentCreator.createDocument(
            source, 
            'enquiry_source',
            createEnquirySourceMetadata(source, integration)
        )
    );

    await langchainService.addDocuments(
        documents,
        integration.customer_id.toString()
    );

    logger.info(`Successfully processed ${sources.length} enquiry sources`);
    return sources.length;
};

const processContactClasses = async (client, integration, langchainService, logger) => {
    logger.info('Processing Agentbox contact classes...');
    
    const classes = await client.getContactClasses();
    if (classes.length === 0) {
        logger.info('No contact classes found to process');
        return 0;
    }

    logger.info(`Creating documents for ${classes.length} contact classes`);
    
    const documents = classes.map(contactClass => 
        AgentboxDocumentCreator.createDocument(
            contactClass, 
            'contact_class',
            createContactClassMetadata(contactClass, integration)
        )
    );

    await langchainService.addDocuments(
        documents,
        integration.customer_id.toString()
    );

    logger.info(`Successfully processed ${classes.length} contact classes`);
    return classes.length;
};

const processContactSources = async (client, integration, langchainService, logger) => {
    logger.info('Processing Agentbox contact sources...');
    
    const sources = await client.getContactSources();
    if (sources.length === 0) {
        logger.info('No contact sources found to process');
        return 0;
    }

    logger.info(`Creating documents for ${sources.length} contact sources`);
    
    const documents = sources.map(source => 
        AgentboxDocumentCreator.createDocument(
            source, 
            'contact_source',
            createContactSourceMetadata(source, integration)
        )
    );

    await langchainService.addDocuments(
        documents,
        integration.customer_id.toString()
    );

    logger.info(`Successfully processed ${sources.length} contact sources`);
    return sources.length;
};

const processOffices = async (client, integration, langchainService, logger) => {
    logger.info('Processing Agentbox offices...');
    
    const offices = await client.getOffices();
    if (offices.length === 0) {
        logger.info('No offices found to process');
        return 0;
    }

    logger.info(`Creating documents for ${offices.length} offices`);
    
    const documents = offices.map(office => 
        AgentboxDocumentCreator.createDocument(
            office, 
            'office',
            createOfficeMetadata(office, integration)
        )
    );

    await langchainService.addDocuments(
        documents,
        integration.customer_id.toString()
    );

    logger.info(`Successfully processed ${offices.length} offices`);
    return offices.length;
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
        name: 'office',
        process: processOffices,
        description: 'Real estate office locations and business units',
        fields: [
            {
                name: 'id',
                type: 'string',
                description: 'Unique identifier for the office'
            },
            {
                name: 'name',
                type: 'string',
                description: 'Name of the office'
            },
            {
                name: 'status',
                type: 'string',
                description: 'Current status of the office'
            },
            {
                name: 'companyName',
                type: 'string',
                description: 'Legal company name'
            },
            {
                name: 'tradingName',
                type: 'string',
                description: 'Trading name of the office'
            },
            {
                name: 'address',
                type: 'object',
                description: 'Physical location details'
            },
            {
                name: 'location',
                type: 'object',
                description: 'Geographic coordinates'
            },
            {
                name: 'website',
                type: 'string',
                description: 'Office website URL'
            },
            {
                name: 'email',
                type: 'string',
                description: 'Primary contact email'
            },
            {
                name: 'phone',
                type: 'string',
                description: 'Primary contact phone'
            }
        ],
        aiCapabilities: [
            {
                name: 'geographic_analysis',
                description: 'Analyze office coverage and market presence'
            },
            {
                name: 'performance_tracking',
                description: 'Track and compare office performance metrics'
            },
            {
                name: 'resource_optimization',
                description: 'Optimize resource allocation across offices'
            },
            {
                name: 'market_coverage',
                description: 'Analyze market coverage and identify gaps'
            }
        ]
    },
    {
        name: 'contact_class',
        process: processContactClasses,
        description: 'Classification and categorization of contacts in the system',
        fields: [
            {
                name: 'id',
                type: 'string',
                description: 'Unique identifier for the contact class'
            },
            {
                name: 'name',
                type: 'string',
                description: 'Name of the contact class'
            },
            {
                name: 'type',
                type: 'string',
                description: 'Type of the contact class (e.g., Standard)'
            },
            {
                name: 'displayName',
                type: 'string',
                description: 'Display name for the contact class'
            }
        ],
        aiCapabilities: [
            {
                name: 'relationship_mapping',
                description: 'Map and analyze relationships between different contact types'
            },
            {
                name: 'contact_segmentation',
                description: 'Segment contacts based on their roles and relationships'
            },
            {
                name: 'interaction_analysis',
                description: 'Analyze interaction patterns by contact class'
            },
            {
                name: 'engagement_optimization',
                description: 'Optimize engagement strategies for different contact types'
            }
        ]
    },
    {
        name: 'enquiry_source',
        process: processEnquirySources,
        description: 'Sources of property enquiries and lead generation channels',
        fields: [
            {
                name: 'id',
                type: 'string',
                description: 'Unique identifier for the enquiry source'
            },
            {
                name: 'name',
                type: 'string',
                description: 'Name of the enquiry source channel'
            }
        ],
        aiCapabilities: [
            {
                name: 'channel_effectiveness',
                description: 'Analyze effectiveness of different lead generation channels'
            },
            {
                name: 'source_attribution',
                description: 'Track and attribute leads to their originating sources'
            },
            {
                name: 'conversion_analysis',
                description: 'Analyze conversion rates by enquiry source'
            },
            {
                name: 'channel_optimization',
                description: 'Recommend optimal channel mix based on performance'
            }
        ]
    },
    {
        name: 'region',
        process: processRegions,
        description: 'Geographic regions for property location classification',
        fields: [
            {
                name: 'name',
                type: 'string',
                description: 'Name of the region'
            },
            {
                name: 'group',
                type: 'string',
                description: 'Regional group (e.g., Sydney Region)'
            },
            {
                name: 'state',
                type: 'string',
                description: 'State/territory code'
            },
            {
                name: 'country',
                type: 'string',
                description: 'Country name'
            }
        ],
        aiCapabilities: [
            {
                name: 'location_analysis',
                description: 'Analyze property distribution and trends by region'
            },
            {
                name: 'market_segmentation',
                description: 'Segment market data by geographic regions'
            },
            {
                name: 'area_matching',
                description: 'Match buyer preferences with regional characteristics'
            },
            {
                name: 'demographic_insights',
                description: 'Generate insights about regional demographics and preferences'
            }
        ]
    },
    {
        name: 'property_type',
        process: processPropertyTypes,
        description: 'Property type classifications for real estate listings',
        fields: [
            {
                name: 'id',
                type: 'string',
                description: 'Unique identifier for the property type'
            },
            {
                name: 'type',
                type: 'string',
                description: 'Name of the property type (e.g., Residential, Commercial)'
            }
        ],
        aiCapabilities: [
            {
                name: 'market_analysis',
                description: 'Analyze market trends and performance by property type'
            },
            {
                name: 'property_matching',
                description: 'Match properties with buyer preferences based on type'
            },
            {
                name: 'investment_insights',
                description: 'Generate insights about different property type investments'
            }
        ]
    },
    {
        name: 'interest_level',
        process: processInterestLevels,
        description: 'Standardized interest levels for enquiries and leads',
        fields: [
            {
                name: 'id',
                type: 'string',
                description: 'Unique identifier for the interest level'
            },
            {
                name: 'name',
                type: 'string',
                description: 'Name of the interest level (e.g., Hot, Warm, Cold)'
            }
        ],
        aiCapabilities: [
            {
                name: 'lead_scoring',
                description: 'Score leads based on engagement patterns and interest level'
            },
            {
                name: 'engagement_prediction',
                description: 'Predict likely engagement level based on contact behavior'
            },
            {
                name: 'conversion_probability',
                description: 'Calculate probability of conversion based on interest level history'
            }
        ]
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
    },
    {
        name: 'contact_source',
        process: processContactSources,
        description: 'Sources and channels through which contacts are acquired',
        fields: [
            {
                name: 'id',
                type: 'string',
                description: 'Unique identifier for the contact source'
            },
            {
                name: 'name',
                type: 'string',
                description: 'Name of the contact acquisition source'
            }
        ],
        aiCapabilities: [
            {
                name: 'source_effectiveness',
                description: 'Analyze effectiveness of different contact acquisition channels'
            },
            {
                name: 'lead_quality',
                description: 'Assess lead quality by source channel'
            },
            {
                name: 'channel_roi',
                description: 'Calculate return on investment for each source channel'
            },
            {
                name: 'acquisition_optimization',
                description: 'Optimize contact acquisition strategy across channels'
            }
        ]
    }
];

module.exports = {
    entityTypes,
    processContacts,
    processListings,
    processStaff,
    processInterestLevels,
    processPropertyTypes,
    processRegions,
    processEnquirySources,
    processContactClasses,
    processContactSources,
    processOffices
}; 