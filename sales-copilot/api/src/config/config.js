require('dotenv').config();

const config = {
    pinecone: {
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT,
        indexName: process.env.PINECONE_INDEX_NAME,
    },
    database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    },
    integrations: {
        pipedrive: {
            clientId: process.env.PIPEDRIVE_CLIENT_ID,
            clientSecret: process.env.PIPEDRIVE_CLIENT_SECRET,
            redirectUri: process.env.PIPEDRIVE_REDIRECT_URI,
        }
    }
};

module.exports = config; 