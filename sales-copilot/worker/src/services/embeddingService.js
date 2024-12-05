const OpenAI = require('openai');

class EmbeddingService {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error('OpenAI API key is required');
        }
        this.openai = new OpenAI({ apiKey });
        this.model = "text-embedding-3-large";
    }

    async createEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: this.model,
                input: text,
                encoding_format: "float"
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error('Error creating embedding:', error);
            throw error;
        }
    }

    async createBatchEmbeddings(texts) {
        try {
            const response = await this.openai.embeddings.create({
                model: this.model,
                input: texts,
                encoding_format: "float"
            });
            return response.data.map(item => item.embedding);
        } catch (error) {
            console.error('Error creating batch embeddings:', error);
            throw error;
        }
    }
}

module.exports = EmbeddingService; 