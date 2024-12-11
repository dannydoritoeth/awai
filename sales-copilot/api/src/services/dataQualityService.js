const { Pool } = require('pg');
const logger = require('../../services/logger');

class DataQualityService {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
        });

        // Load analyzers dynamically
        this.analyzers = {
            'agentbox': require('../../worker/src/integrations/agentbox/dataQualityAnalyzer'),
            'pipedrive': require('../../worker/src/integrations/pipedrive/dataQualityAnalyzer')
        };
    }

    async analyzeQuality(customerId, integrationId, entityType, data) {
        try {
            // Get integration type
            const integration = await this.getIntegration(integrationId);
            if (!integration) {
                throw new Error(`Integration not found: ${integrationId}`);
            }

            // Get the appropriate analyzer
            const analyzer = this.analyzers[integration.type];
            if (!analyzer) {
                throw new Error(`No analyzer found for integration type: ${integration.type}`);
            }

            // Add customer context to data
            const enrichedData = {
                ...data,
                customerId
            };

            // Run analysis
            const report = await analyzer.analyzeQuality(entityType, enrichedData);

            // Store report
            await this.storeQualityReport(customerId, integrationId, report);

            return report;
        } catch (error) {
            logger.error('Error analyzing data quality:', error);
            throw error;
        }
    }

    async getIntegration(integrationId) {
        const query = `
            SELECT id, type, name
            FROM integrations
            WHERE id = $1
        `;
        const result = await this.pool.query(query, [integrationId]);
        return result.rows[0];
    }

    async storeQualityReport(customerId, integrationId, report) {
        const query = `
            INSERT INTO data_quality_reports (
                customer_id,
                integration_id,
                entity_id,
                entity_type,
                quality_score,
                issues,
                warnings,
                last_checked
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (customer_id, integration_id, entity_id, entity_type)
            DO UPDATE SET
                quality_score = $5,
                issues = $6,
                warnings = $7,
                last_checked = $8
        `;

        await this.pool.query(query, [
            customerId,
            integrationId,
            report.entityId,
            report.entityType,
            report.qualityScore,
            JSON.stringify(report.issues),
            JSON.stringify(report.warnings),
            report.lastChecked
        ]);
    }

    async getQualityReport(customerId, integrationId, entityId, entityType) {
        const query = `
            SELECT *
            FROM data_quality_reports
            WHERE customer_id = $1
            AND integration_id = $2
            AND entity_id = $3
            AND entity_type = $4
        `;

        const result = await this.pool.query(query, [
            customerId,
            integrationId,
            entityId,
            entityType
        ]);
        return result.rows[0] || null;
    }

    async getCustomerQualityReports(customerId, integrationId = null, entityType = null, minQualityScore = null) {
        let query = `
            SELECT *
            FROM data_quality_reports
            WHERE customer_id = $1
        `;
        const params = [customerId];

        if (integrationId) {
            query += ` AND integration_id = $${params.length + 1}`;
            params.push(integrationId);
        }

        if (entityType) {
            query += ` AND entity_type = $${params.length + 1}`;
            params.push(entityType);
        }

        if (minQualityScore !== null) {
            query += ` AND quality_score <= $${params.length + 1}`;
            params.push(minQualityScore);
        }

        query += ` ORDER BY quality_score ASC`;

        const result = await this.pool.query(query, params);
        return result.rows;
    }
}

module.exports = new DataQualityService(); 