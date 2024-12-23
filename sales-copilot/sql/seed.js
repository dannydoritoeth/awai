require('dotenv').config({ path: '../api/.env' });
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function seedDatabase() {
    try {
        // Insert Pipedrive integration
        await pool.query(`
            INSERT INTO integrations (name, type, auth_type, config) 
            VALUES ($1, $2, $3, $4)
        `, [
            'Pipedrive',
            'pipedrive',
            'oauth2',
            JSON.stringify({
                client_id: process.env.PIPEDRIVE_CLIENT_ID,
                client_secret: process.env.PIPEDRIVE_CLIENT_SECRET,
                redirect_uri: process.env.PIPEDRIVE_REDIRECT_URI,
                scopes: ["deals:read"]
            })
        ]);

        // Insert Agentbox integration
        await pool.query(`
            INSERT INTO integrations (name, type, auth_type, config) 
            VALUES ($1, $2, $3, $4)
        `, [
            'Agentbox',
            'agentbox',
            'api_key',
            JSON.stringify({
                base_url: process.env.AGENTBOX_API_URL || 'https://api.agentboxcrm.com.au',
                version: process.env.AGENTBOX_API_VERSION || '2'
            })
        ]);

        // Insert test customer
        const customerResult = await pool.query(`
            INSERT INTO customers (name, email) 
            VALUES ($1, $2)
            RETURNING id
        `, ['Test Company', 'test@example.com']);

        const customerId = customerResult.rows[0].id;

        // Insert test Pipedrive integration
        await pool.query(`
            INSERT INTO customer_integrations (
                customer_id,
                integration_id,
                credentials,
                auth_status,
                connection_settings,
                is_active
            ) 
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            customerId, // customer_id
            1, // integration_id (Pipedrive)
            JSON.stringify({
                access_token: process.env.PIPEDRIVE_TEST_ACCESS_TOKEN,
                refresh_token: process.env.PIPEDRIVE_TEST_REFRESH_TOKEN,
                token_type: "Bearer"
            }),
            'active',
            JSON.stringify({
                company_domain: process.env.PIPEDRIVE_TEST_COMPANY_DOMAIN,
                user_id: process.env.PIPEDRIVE_TEST_USER_ID,
                company_id: process.env.PIPEDRIVE_TEST_COMPANY_ID,
                api_token: process.env.PIPEDRIVE_TEST_ACCESS_TOKEN
            }),
            true
        ]);

        // Insert test Agentbox integration
        await pool.query(`
            INSERT INTO customer_integrations (
                customer_id,
                integration_id,
                credentials,
                auth_status,
                connection_settings,
                is_active
            ) 
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            customerId, // customer_id
            2, // integration_id (Agentbox)
            JSON.stringify({}), // No credentials needed for API key auth
            'active',
            JSON.stringify({
                clientId: process.env.AGENTBOX_CLIENT_ID,
                apiKey: process.env.AGENTBOX_API_KEY
            }),
            true
        ]);

        console.log('Database seeded successfully');
    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await pool.end();
    }
}

seedDatabase(); 