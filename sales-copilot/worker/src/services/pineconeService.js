const { Pinecone } = require('@pinecone-database/pinecone');

class PineconeService {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Pinecone API key is required');
        }

        this.pinecone = new Pinecone({
            apiKey: apiKey
        });
    }

    async initialize(namespace) {
        try {
            const indexName = 'sales-copilot';
            this.index = this.pinecone.index(indexName).namespace(namespace);
            // Test the connection
            await this.pinecone.index(indexName).describeIndexStats();
        } catch (error) {
            console.error('Pinecone initialization error:', error);
            throw error;
        }
    }

    async upsertBatch(vectors, namespace, batchSize = 100) {
        if (!this.index || this.currentNamespace !== namespace) {
            await this.initialize(namespace);
            this.currentNamespace = namespace;
        }
        
        for (let i = 0; i < vectors.length; i += batchSize) {
            const batch = vectors.slice(i, i + batchSize).map(({ id, vector, metadata }) => ({
                id,
                values: vector,
                metadata
            }));
            
            await this.index.upsert(batch);
            console.log(`Upserted batch of ${batch.length} vectors to namespace: ${namespace}`);
        }
    }
}

module.exports = PineconeService; 