const { PineconeStore } = require("@langchain/pinecone");
const { Pinecone } = require('@pinecone-database/pinecone');

const LOG_LEVELS = {
    ERROR: 0,
    INFO: 1,
    DEBUG: 2
};

class LangchainPineconeService {
    constructor(apiKey, embeddingService, logLevel = LOG_LEVELS.INFO) {
        const client = new Pinecone({
            apiKey: apiKey
        });

        this.embeddings = embeddingService;
        this.pineconeIndex = client.Index("sales-copilot");
        this.logLevel = logLevel;
    }

    log(level, message, data = null) {
        if (level <= this.logLevel) {
            switch (level) {
                case LOG_LEVELS.ERROR:
                    console.error(message, data || '');
                    break;
                case LOG_LEVELS.INFO:
                    console.log(message, data ? `(${JSON.stringify(data)})` : '');
                    break;
                case LOG_LEVELS.DEBUG:
                    console.log('DEBUG:', message, data || '');
                    break;
            }
        }
    }

    async addDocuments(documents, namespace) {
        if (!documents || documents.length === 0) return;

        this.log(LOG_LEVELS.INFO, `Processing ${documents.length} documents for namespace ${namespace}`);

        try {
            const vectorStore = await PineconeStore.fromDocuments(
                documents,
                this.embeddings,
                {
                    pineconeIndex: this.pineconeIndex,
                    namespace: namespace,
                }
            );
            
            this.log(LOG_LEVELS.INFO, `Successfully stored ${documents.length} documents`);
            return vectorStore;
        } catch (error) {
            this.log(LOG_LEVELS.ERROR, 'Failed to store documents:', error);
            throw error;
        }
    }
}

module.exports = {
    LangchainPineconeService,
    LOG_LEVELS
}; 