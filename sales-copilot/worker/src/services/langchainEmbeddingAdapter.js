class LangchainEmbeddingAdapter {
    constructor(embeddingService) {
        this.embeddingService = embeddingService;
    }

    async embedQuery(text) {
        return await this.embeddingService.createEmbedding(text);
    }

    async embedDocuments(documents) {
        try {
            // Extract text content from documents
            const texts = documents.map(doc => {
                if (typeof doc === 'string') {
                    return doc;
                }
                if (!doc.pageContent) {
                    throw new Error('Document missing pageContent');
                }
                return doc.pageContent;
            });

            return await this.embeddingService.createBatchEmbeddings(texts);
        } catch (error) {
            console.error('Error in embedDocuments:', error);
            throw error;
        }
    }
}

module.exports = LangchainEmbeddingAdapter; 