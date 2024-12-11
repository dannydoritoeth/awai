const crypto = require('crypto');
const { Pool } = require('pg');
const pool = new Pool(); // Configure with your DB credentials
const dbHelper = require('./dbHelper');

class IntegrationService {
    constructor() {
        this.integrationHandlers = {
            pipedrive: require('../integrations/pipedrive/auth')
        };
    }

    async getAuthUrl(integrationType, customerId) {
        const handler = this.integrationHandlers[integrationType];
        if (!handler) {
            throw new Error(`Unsupported integration: ${integrationType}`);
        }

        // Encrypt customer ID to use as state parameter
        const state = this.encryptState(customerId);
        return handler.getAuthUrl(state);
    }

    async handleOAuthCallback(integrationType, code, customerId) {
        const handler = this.integrationHandlers[integrationType];
        if (!handler) {
            throw new Error(`Unsupported integration: ${integrationType}`);
        }

        // Get access token and other credentials
        const credentials = await handler.exchangeCodeForToken(code);

        // Save credentials to database
        await this.saveCredentials(customerId, integrationType, credentials);
    }

    async saveCredentials(customerId, integrationType, credentials) {
        await dbHelper.transaction(async (client) => {
            // Get integration ID
            const integrationRes = await client.query(
                'SELECT id FROM integrations WHERE type = $1',
                [integrationType]
            );
            const integrationId = integrationRes.rows[0].id;

            // Upsert customer integration
            await client.query(`
                INSERT INTO customer_integrations (customer_id, integration_id, credentials)
                VALUES ($1, $2, $3)
                ON CONFLICT (customer_id, integration_id)
                DO UPDATE SET 
                    credentials = $3,
                    auth_status = 'active',
                    updated_at = CURRENT_TIMESTAMP
            `, [customerId, integrationId, credentials]);
        });
    }

    encryptState(customerId) {
        // Implement state encryption using crypto
        // This is a simplified example - use proper encryption in production
        return Buffer.from(JSON.stringify({ customerId, timestamp: Date.now() }))
            .toString('base64');
    }

    validateAndDecodeState(state) {
        // Implement state validation and decryption
        // This is a simplified example - use proper decryption in production
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
        
        // Validate timestamp to prevent replay attacks
        if (Date.now() - decoded.timestamp > 3600000) { // 1 hour expiry
            throw new Error('State parameter expired');
        }

        return decoded.customerId;
    }
}

module.exports = new IntegrationService(); 