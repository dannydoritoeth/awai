const { PineconeClient } = require('@pinecone-database/pinecone');
const config = require('../config/config');

class PineconeHelper {
    constructor() {
        this.client = new PineconeClient();
        this.indexName = config.pinecone.indexName;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            await this.client.init({
                apiKey: config.pinecone.apiKey,
                environment: config.pinecone.environment,
            });
            
            this.index = this.client.Index(this.indexName);
            this.initialized = true;
            
            // Verify connection by describing index
            await this.index.describeIndexStats();
        } catch (error) {
            console.error('Pinecone initialization error:', error);
            throw new Error('Failed to initialize Pinecone client');
        }
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    async upsertVectors(vectors) {
        await this.ensureInitialized();
        
        try {
            const response = await this.index.upsert({ vectors });
            return response;
        } catch (error) {
            console.error('Pinecone upsert error:', error);
            throw new Error('Failed to upsert vectors to Pinecone');
        }
    }

    async queryVectors(query, filter = {}, topK = 10) {
        await this.ensureInitialized();
        
        try {
            const response = await this.index.query({
                vector: query,
                filter,
                topK,
                includeMetadata: true
            });
            return response.matches;
        } catch (error) {
            console.error('Pinecone query error:', error);
            throw new Error('Failed to query vectors from Pinecone');
        }
    }

    async deleteVectors(ids) {
        await this.ensureInitialized();
        
        try {
            await this.index.delete1({ ids });
        } catch (error) {
            console.error('Pinecone delete error:', error);
            throw new Error('Failed to delete vectors from Pinecone');
        }
    }

    async getIndexStats() {
        await this.ensureInitialized();
        
        try {
            const stats = await this.index.describeIndexStats();
            return stats;
        } catch (error) {
            console.error('Pinecone stats error:', error);
            throw new Error('Failed to get Pinecone index stats');
        }
    }
}

// Export as singleton
module.exports = new PineconeHelper(); 