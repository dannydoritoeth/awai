const { Pinecone } = require('@pinecone-database/pinecone');

class PineconeService {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('Pinecone API key is required');
        }

        this.pinecone = new Pinecone({
            apiKey: apiKey,
            environment: process.env.PINECONE_ENVIRONMENT
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

    async query({ vector, filter = {}, topK = 10, includeMetadata = true }) {
        try {
            if (!vector) {
                // If no vector is provided, use a metadata-only query
                const response = await this.index.query({
                    filter,
                    topK,
                    includeMetadata
                });
                return response.matches;
            }

            const response = await this.index.query({
                vector,
                filter,
                topK,
                includeMetadata
            });
            return response.matches;
        } catch (error) {
            console.error('Pinecone query error:', error);
            throw error;
        }
    }
}

module.exports = PineconeService; 