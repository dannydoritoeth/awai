const { Pool } = require('pg');
const config = require('../config/config');

class DbHelper {
    constructor() {
        console.log('Initializing database connection with config:', {
            host: config.database.host,
            port: config.database.port,
            database: config.database.database,
            user: config.database.user,
            // password omitted for security
        });

        this.pool = new Pool(config.database);
        
        // Error handling
        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
            process.exit(-1);
        });
    }

    async query(text, params) {
        try {
            console.log('Executing query:', text, 'with params:', params);
            const result = await this.pool.query(text, params);
            return result;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    async getClient() {
        const client = await this.pool.connect();
        const query = client.query.bind(client);
        const release = client.release.bind(client);

        // Overriding release to make it safer
        client.release = () => {
            client.release = release;
            return release();
        };

        return client;
    }

    async transaction(callback) {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

// Export as singleton
module.exports = new DbHelper(); 