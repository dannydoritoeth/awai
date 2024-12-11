const PineconeService = require('../services/pineconeService');
const dbHelper = require('../services/dbHelper');

class SearchController {
    async query(req, res) {
        try {
            const { customerId, query, filter = {}, topK = 10 } = req.body;

            if (!customerId) {
                return res.status(400).json({ error: 'Customer ID is required' });
            }

            if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_ENVIRONMENT) {
                throw new Error('Pinecone configuration is incomplete');
            }

            // Initialize Pinecone service with the customer's namespace
            const pineconeService = new PineconeService(process.env.PINECONE_API_KEY);
            await pineconeService.initialize(customerId.toString());

            // Query Pinecone
            const results = await pineconeService.query({
                vector: query,
                filter,
                topK,
                includeMetadata: true
            });

            res.json({
                success: true,
                results
            });

        } catch (error) {
            console.error('Search error:', error);
            res.status(500).json({ 
                error: 'Search failed',
                message: error.message 
            });
        }
    }
}

module.exports = new SearchController(); 