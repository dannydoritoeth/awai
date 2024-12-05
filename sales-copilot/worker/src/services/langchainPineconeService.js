const { PineconeStore } = require("@langchain/pinecone");
const { Pinecone } = require('@pinecone-database/pinecone');
const { Document } = require("@langchain/core/documents");

class LangchainPineconeService {
    constructor(apiKey, embeddingService) {
        const client = new Pinecone({
            apiKey: apiKey
        });

        this.embeddings = embeddingService;
        this.pineconeIndex = client.Index("sales-copilot");
    }

    async addDocuments(vectors, namespace) {
        // Create simple documents
        const docs = [
            new Document({
                metadata: { id: "1" },
                pageContent: "Sample text about a deal",
            }),
            new Document({
                metadata: { id: "2" },
                pageContent: "Another sample text about a person",
            }),
        ];

        // Create vector store
        const vectorStore = await PineconeStore.fromDocuments(
            docs,
            this.embeddings,
            {
                pineconeIndex: this.pineconeIndex,
                namespace: namespace,
            }
        );

        return vectorStore;
    }
}

module.exports = LangchainPineconeService; 