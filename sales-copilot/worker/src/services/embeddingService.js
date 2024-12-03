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
                encoding_format: "float",
            });

            return response.data[0].embedding;
        } catch (error) {
            console.error('Error creating embedding:', error);
            throw new Error('Failed to create embedding');
        }
    }

    async createBatchEmbeddings(texts, batchSize = 10) {
        const embeddings = [];
        
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const response = await this.openai.embeddings.create({
                model: this.model,
                input: batch,
                encoding_format: "float",
            });
            
            embeddings.push(...response.data.map(item => item.embedding));
        }
        
        return embeddings;
    }

    // Helper to create deal text for embedding
    createDealText(deal) {
        const parts = [
            `Title: ${deal.title}`,
            `Status: ${deal.status}`,
            `Value: ${deal.value} ${deal.currency}`,
            `Stage: ${deal.stage_id}`,
        ];

        if (deal.notes) parts.push(`Notes: ${deal.notes}`);
        if (deal.description) parts.push(`Description: ${deal.description}`);
        
        return parts.join('\n');
    }
}

module.exports = EmbeddingService; 