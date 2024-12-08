const SalesforceDocumentCreator = require('./documentCreator');

const createMetadata = (entity, integration, type) => ({
    customerId: integration.customer_id.toString(),
    customerName: integration.customer_name,
    entityId: entity.Id,
    type,
    source: 'salesforce',
    createdDate: entity.CreatedDate,
    lastModifiedDate: entity.LastModifiedDate
});

const createLeadMetadata = (lead, integration) => ({
    ...createMetadata(lead, integration, 'lead'),
    leadId: lead.Id,
    company: lead.Company,
    status: lead.Status,
    isConverted: lead.IsConverted,
    convertedAccountId: lead.ConvertedAccountId,
    convertedContactId: lead.ConvertedContactId,
    convertedOpportunityId: lead.ConvertedOpportunityId,
    convertedDate: lead.ConvertedDate,
    lastActivityDate: lead.LastActivityDate
});

const processLeads = async (client, integration, langchainPinecone, logger) => {
    logger.info('Processing Salesforce leads...');
    
    const leads = await client.getAllLeads();
    if (leads.length === 0) {
        logger.info('No leads found to process');
        return 0;
    }

    logger.info(`Creating documents for ${leads.length} leads`);
    
    const documents = leads.map(lead => 
        SalesforceDocumentCreator.createDocument(
            lead, 
            'lead',
            createLeadMetadata(lead, integration)
        )
    );

    logger.info(`Storing ${documents.length} lead documents in vector database`);
    
    await langchainPinecone.addDocuments(
        documents,
        integration.customer_id.toString()
    );

    logger.info(`Successfully processed ${leads.length} leads`);
    return leads.length;
};

// Add other entity processors here...

const entityTypes = [
    { 
        name: 'leads',
        process: processLeads
    }
    // Add other entity types as needed
];

module.exports = {
    entityTypes,
    processLeads
}; 