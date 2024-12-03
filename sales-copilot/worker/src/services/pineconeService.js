const { Pinecone } = require('@pinecone-database/pinecone');

class PineconeService {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Pinecone API key is required');
        }

        this.pinecone = new Pinecone({
            apiKey: apiKey
        });
        // this.index = null;
        // this.dimension = 3072;
    }

    async initialize() {
        try {
            this.index = this.pinecone.index('sales-copilot');
            // Test the connection
            await this.index.describeIndexStats();
        } catch (error) {
            console.error('Pinecone initialization error:', error);
            throw error;
        }
    }

    async upsertBatch(vectors, namespace, batchSize = 100) {
        if (!this.index) await this.initialize();
        
        for (let i = 0; i < vectors.length; i += batchSize) {
            const batch = vectors.slice(i, i + batchSize).map(({ id, vector, metadata }) => ({
                id,
                values: vector,
                metadata
            }));
            
            await this.index.upsert(batch, { namespace });
        }
    }
}

module.exports = PineconeService; 