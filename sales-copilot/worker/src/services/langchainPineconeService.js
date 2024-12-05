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
        console.log('Processing vectors:', {
            count: vectors.length,
            sample: {
                id: vectors[0].id,
                type: vectors[0].metadata.type,
                hasEmbedding: !!vectors[0].values
            }
        });

        // Convert our vectors to LangChain documents
        const docs = vectors.map(vector => new Document({
            pageContent: this.createTextFromMetadata(vector.metadata),
            metadata: vector.metadata
        }));

        console.log('Sample document:', {
            pageContent: docs[0].pageContent.substring(0, 100) + '...',
            metadata: {
                type: docs[0].metadata.type,
                source: docs[0].metadata.source,
                id: docs[0].metadata.id
            }
        });

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

    createTextFromMetadata(metadata) {
        const parts = [];
        
        // Common fields
        if (metadata.type) parts.push(`Type: ${metadata.type}`);
        if (metadata.source) parts.push(`Source: ${metadata.source}`);
        
        // Type-specific fields
        switch (metadata.type) {
            case 'deal':
                if (metadata.title) parts.push(`Title: ${metadata.title}`);
                if (metadata.value) parts.push(`Value: ${metadata.value} ${metadata.currency || ''}`);
                if (metadata.status) parts.push(`Status: ${metadata.status}`);
                if (metadata.organizationName) parts.push(`Organization: ${metadata.organizationName}`);
                if (metadata.personName) parts.push(`Person: ${metadata.personName}`);
                break;
                
            case 'person':
                if (metadata.name) parts.push(`Name: ${metadata.name}`);
                if (metadata.email) parts.push(`Email: ${metadata.email}`);
                if (metadata.phone) parts.push(`Phone: ${metadata.phone}`);
                if (metadata.organizationName) parts.push(`Organization: ${metadata.organizationName}`);
                break;
                
            case 'organization':
                if (metadata.name) parts.push(`Name: ${metadata.name}`);
                if (metadata.address) parts.push(`Address: ${metadata.address}`);
                if (metadata.email) parts.push(`Email: ${metadata.email}`);
                if (metadata.phone) parts.push(`Phone: ${metadata.phone}`);
                break;
                
            case 'note':
                if (metadata.content) parts.push(`Content: ${metadata.content}`);
                break;
                
            case 'activity':
                if (metadata.subject) parts.push(`Subject: ${metadata.subject}`);
                if (metadata.type) parts.push(`Activity Type: ${metadata.type}`);
                if (metadata.dueDate) parts.push(`Due: ${metadata.dueDate} ${metadata.dueTime || ''}`);
                if (metadata.note) parts.push(`Note: ${metadata.note}`);
                break;
                
            case 'lead':
                if (metadata.title) parts.push(`Title: ${metadata.title}`);
                if (metadata.value) parts.push(`Value: ${metadata.value} ${metadata.currency || ''}`);
                if (metadata.status) parts.push(`Status: ${metadata.status}`);
                if (metadata.personName) parts.push(`Person: ${metadata.personName}`);
                if (metadata.organizationName) parts.push(`Organization: ${metadata.organizationName}`);
                break;
        }

        return parts.join('\n');
    }
}

module.exports = LangchainPineconeService; 