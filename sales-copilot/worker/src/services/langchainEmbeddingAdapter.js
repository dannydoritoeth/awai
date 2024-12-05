class LangchainEmbeddingAdapter {
    constructor(embeddingService) {
        this.embeddingService = embeddingService;
    }

    async embedQuery(text) {
        return await this.embeddingService.createEmbedding(text);
    }

    async embedDocuments(texts) {
        return await this.embeddingService.createBatchEmbeddings(texts);
    }
}

module.exports = LangchainEmbeddingAdapter; 