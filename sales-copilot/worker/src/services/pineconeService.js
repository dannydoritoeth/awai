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

    async deleteAll(namespace) {
        try {
            if (!this.index || this.currentNamespace !== namespace) {
                await this.initialize(namespace);
                this.currentNamespace = namespace;
            }

            // Delete all vectors in the namespace
            await this.index.deleteAll();
            console.log(`Deleted all vectors in namespace: ${namespace}`);
        } catch (error) {
            console.error(`Error deleting all vectors in namespace ${namespace}:`, error);
            throw error;
        }
    }

    async delete(namespace, ids) {
        try {
            if (!this.index || this.currentNamespace !== namespace) {
                await this.initialize(namespace);
                this.currentNamespace = namespace;
            }

            // Delete specific vectors by ID
            await this.index.deleteMany(ids);
            console.log(`Deleted ${ids.length} vectors in namespace: ${namespace}`);
        } catch (error) {
            console.error(`Error deleting vectors in namespace ${namespace}:`, error);
            throw error;
        }
    }

    async deleteByType(namespace, type) {
        try {
            if (!this.index || this.currentNamespace !== namespace) {
                await this.initialize(namespace);
                this.currentNamespace = namespace;
            }

            // First, fetch all IDs of the specified type
            const response = await this.index.fetch({
                filter: { type }
            });

            if (response && Object.keys(response.vectors).length > 0) {
                const ids = Object.keys(response.vectors);
                await this.index.deleteMany(ids);
                console.log(`Deleted ${ids.length} vectors of type '${type}' in namespace: ${namespace}`);
            } else {
                console.log(`No vectors found of type '${type}' in namespace: ${namespace}`);
            }
        } catch (error) {
            console.error(`Error deleting vectors of type '${type}' in namespace ${namespace}:`, error);
            throw error;
        }
    }

    async deleteByCustomerId(customerId) {
        const namespace = customerId.toString();
        try {
            await this.deleteAll(namespace);
            console.log(`Deleted all vectors for customer ${customerId}`);
        } catch (error) {
            console.error(`Error deleting vectors for customer ${customerId}:`, error);
            throw error;
        }
    }

    async deleteByTypeAndCustomerId(customerId, type) {
        const namespace = customerId.toString();
        try {
            await this.deleteByType(namespace, type);
            console.log(`Deleted all vectors of type '${type}' for customer ${customerId}`);
        } catch (error) {
            console.error(`Error deleting vectors of type '${type}' for customer ${customerId}:`, error);
            throw error;
        }
    }
}

module.exports = PineconeService; 