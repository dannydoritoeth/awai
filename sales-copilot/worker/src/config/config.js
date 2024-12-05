const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
    pinecone: {
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT,
        indexName: process.env.PINECONE_INDEX_NAME,
        host: process.env.PINECONE_HOST,
        dimension: 3072,
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
    },
    agentbox: {
        baseUrl: process.env.AGENTBOX_API_URL || 'https://api.agentboxcrm.com.au',
        version: process.env.AGENTBOX_API_VERSION || '2'
    }
};

// Add debug logging
console.log('Pinecone Config:', {
    apiKey: config.pinecone.apiKey ? 'present' : 'missing',
    environment: config.pinecone.environment,
    indexName: config.pinecone.indexName
});

// Validate required configuration
const requiredEnvVars = {
    'PINECONE_API_KEY': config.pinecone.apiKey,
    'OPENAI_API_KEY': config.openai.apiKey,
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}

module.exports = config; 