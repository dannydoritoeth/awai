const dbHelper = require('../services/dbHelper');
const { LangchainPineconeService, LOG_LEVELS } = require('../services/langchainPineconeService');
const LangchainEmbeddingAdapter = require('../services/langchainEmbeddingAdapter');

class BaseIntegration {
    constructor(embeddingService, pineconeService, testMode = false, testLimit = 3, logLevel = LOG_LEVELS.INFO) {
        this.embeddingService = embeddingService;
        this.pineconeService = pineconeService;
        this.testMode = testMode;
        this.testLimit = testLimit;
        this.logLevel = logLevel;
        
        const embeddingAdapter = new LangchainEmbeddingAdapter(embeddingService);
        this.langchainPinecone = new LangchainPineconeService(
            process.env.PINECONE_API_KEY,
            embeddingAdapter,
            logLevel
        );
    }

    async process(integration) {
        let syncId = null;
        try {
            this.log(LOG_LEVELS.INFO, `Processing ${integration.integration_type} integration`, {
                customerId: integration.customer_id,
                customerName: integration.customer_name
            });
            
            syncId = await this.createSyncRecord(integration.id);
            
            const client = this.createClient(integration);
            const entityTypes = this.getEntityTypes();

            let totalCount = 0;
            for (const entityType of entityTypes) {
                this.log(LOG_LEVELS.INFO, `Processing ${entityType.name}...`);
                const count = await entityType.process(
                    client, 
                    integration, 
                    this.langchainPinecone,
                    {
                        info: (msg) => this.log(LOG_LEVELS.INFO, msg),
                        error: (msg) => this.log(LOG_LEVELS.ERROR, msg),
                        debug: (msg) => this.log(LOG_LEVELS.DEBUG, msg)
                    }
                );
                totalCount += count;
                this.log(LOG_LEVELS.INFO, `Processed ${count} ${entityType.name}`);
            }

            await this.updateSyncStatus(syncId, totalCount, integration.id);
            this.log(LOG_LEVELS.INFO, `Successfully processed ${totalCount} total records`);
        } catch (error) {
            this.log(LOG_LEVELS.ERROR, `Processing failed`, { error });
            await this.updateSyncError(syncId, error.message);
            throw error;
        }
    }

    createClient(integration) {
        throw new Error('createClient must be implemented by subclass');
    }

    getEntityTypes() {
        throw new Error('getEntityTypes must be implemented by subclass');
    }

    // Database helper methods
    async createSyncRecord(integrationId) {
        const result = await dbHelper.query(`
            INSERT INTO sync_history 
            (customer_integration_id, status, sync_type)
            VALUES ($1, 'in_progress', 'full')
            RETURNING id
        `, [integrationId]);
        return result.rows[0].id;
    }

    async updateSyncStatus(syncId, recordCount, integrationId) {
        await dbHelper.query(`
            UPDATE sync_history
            SET status = 'completed',
                completed_at = CURRENT_TIMESTAMP,
                records_processed = $1
            WHERE id = $2
        `, [recordCount, syncId]);

        await dbHelper.query(`
            UPDATE customer_integrations
            SET last_sync_at = CURRENT_TIMESTAMP,
                last_full_sync = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [integrationId]);
    }

    async updateSyncError(syncId, errorMessage) {
        if (syncId) {
            await dbHelper.query(`
                UPDATE sync_history
                SET status = 'failed',
                    completed_at = CURRENT_TIMESTAMP,
                    error_message = $1
                WHERE id = $2
            `, [errorMessage, syncId]);
        }
    }

    log(level, message, data = null) {
        if (level <= this.logLevel) {
            switch (level) {
                case LOG_LEVELS.ERROR:
                    console.error(message, data || '');
                    break;
                case LOG_LEVELS.INFO:
                    console.log(message, data ? `(${JSON.stringify(data)})` : '');
                    break;
                case LOG_LEVELS.DEBUG:
                    console.log('DEBUG:', message, data || '');
                    break;
            }
        }
    }
}

module.exports = BaseIntegration; 