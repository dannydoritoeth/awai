class BaseEntityProcessor {
    static async processEntities(
        entityName,
        fetchFunction,
        createDocuments,
        client,
        integration,
        langchainPinecone,
        logger
    ) {
        logger.info(`Processing ${entityName}...`);
        
        const entities = await fetchFunction(client);
        if (entities.length === 0) {
            logger.info(`No ${entityName} found to process`);
            return 0;
        }

        logger.info(`Creating documents for ${entities.length} ${entityName}`);
        
        const documents = await createDocuments(entities, integration);

        logger.info(`Storing ${documents.length} ${entityName} documents in vector database`);
        
        await langchainPinecone.addDocuments(
            documents,
            integration.customer_id.toString()
        );

        logger.info(`Successfully processed ${entities.length} ${entityName}`);
        return entities.length;
    }
}

module.exports = BaseEntityProcessor; 