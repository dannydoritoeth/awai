const PipedriveDocumentCreator = require('./documentCreator');

const createMetadata = (entity, integration, type) => ({
    customerId: integration.customer_id.toString(),
    customerName: integration.customer_name,
    entityId: entity.id,
    type,
    source: 'pipedrive',
    createdDate: entity.add_time,
    lastModifiedDate: entity.update_time
});

const processDeal = async (client, integration, langchainPinecone, logger) => {
    logger.info('Processing Pipedrive deals...');
    
    const deals = await client.getAllDeals();
    if (deals.length === 0) {
        logger.info('No deals found to process');
        return 0;
    }

    logger.info(`Creating documents for ${deals.length} deals`);
    
    const documents = deals.map(deal => 
        PipedriveDocumentCreator.createDocument(
            deal, 
            'deal',
            createMetadata(deal, integration, 'deal')
        )
    );

    logger.info(`Storing ${documents.length} deal documents in vector database`);
    
    await langchainPinecone.addDocuments(
        documents,
        integration.customer_id.toString()
    );

    logger.info(`Successfully processed ${deals.length} deals`);
    return deals.length;
};

// Add other entity processors (leads, contacts, etc.)...

const entityTypes = [
    { 
        name: 'deals',
        process: processDeal
    }
    // Add other entity types
];

module.exports = {
    entityTypes,
    processDeal
}; 