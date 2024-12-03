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

    async upsertBatch(dealVectors, batchSize = 100) {
        if (!this.index) await this.initialize();
        
        for (let i = 0; i < dealVectors.length; i += batchSize) {
            const batch = dealVectors.slice(i, i + batchSize).map(({ id, vector, metadata }) => ({
                id: `deal_${id}`,
                values: vector,
                metadata
            }));
            
            await this.index.upsert(batch);
        }
    }
}

module.exports = PineconeService; 