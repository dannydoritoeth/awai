const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
    pinecone: {
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT,
        indexName: process.env.PINECONE_INDEX_NAME,
        projectId: process.env.PINECONE_PROJECT_ID,
        host: process.env.PINECONE_HOST
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
    },
    database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    }
};

// Add debug logging for Pinecone config
console.log('Pinecone Configuration:', {
    environment: config.pinecone.environment,
    indexName: config.pinecone.indexName,
    projectId: config.pinecone.projectId,
    hasApiKey: !!config.pinecone.apiKey
});

// Validate required environment variables
for (const [key, value] of Object.entries(config.pinecone)) {
    if (!value) {
        throw new Error(`Missing required Pinecone environment variable: ${key}`);
    }
}

module.exports = config; 