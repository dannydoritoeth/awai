const BaseDataQualityAnalyzer = require('../../services/baseDataQualityAnalyzer');
const { Pool } = require('pg');
const logger = require('../../services/logger');

class HubspotDataQualityAnalyzer extends BaseDataQualityAnalyzer {
    constructor() {
        super();
        this.pool = new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
        });
    }

    async findPotentialDuplicates(entityType, data) {
        switch(entityType) {
            case 'contact':
                return this.findContactDuplicates(data);
            case 'prospective_buyer':
                return this.findProspectiveBuyerDuplicates(data);
            case 'enquiry':
                return this.findEnquiryDuplicates(data);
            default:
                return [];
        }
    }

    async findContactDuplicates(contact) {
        const duplicates = [];
        if (!contact.id) return duplicates;

        try {
            // Check for email duplicates
            if (contact.email) {
                const emailQuery = `
                    SELECT id, email, first_name, last_name, phone
                    FROM hubspot_contacts
                    WHERE customer_id = $1
                    AND email = $2
                    AND id != $3
                `;
                const emailResult = await this.pool.query(emailQuery, [
                    contact.customerId,
                    contact.email,
                    contact.id
                ]);
                duplicates.push(...emailResult.rows.map(row => ({
                    ...row,
                    matchType: 'email',
                    confidence: 'high'
                })));
            }

            // Check for phone duplicates
            if (contact.phone) {
                const phoneQuery = `
                    SELECT id, email, first_name, last_name, phone
                    FROM hubspot_contacts
                    WHERE customer_id = $1
                    AND phone = $2
                    AND id != $3
                `;
                const phoneResult = await this.pool.query(phoneQuery, [
                    contact.customerId,
                    this.normalizePhone(contact.phone),
                    contact.id
                ]);
                duplicates.push(...phoneResult.rows.map(row => ({
                    ...row,
                    matchType: 'phone',
                    confidence: 'high'
                })));
            }

            // Check for name similarity
            if (contact.firstName && contact.lastName) {
                const nameQuery = `
                    SELECT id, email, first_name, last_name, phone
                    FROM hubspot_contacts
                    WHERE customer_id = $1
                    AND id != $2
                    AND (
                        SIMILARITY(first_name || ' ' || last_name, $3) > 0.4
                        OR (
                            SIMILARITY(first_name, $4) > 0.8
                            AND SIMILARITY(last_name, $5) > 0.8
                        )
                    )
                `;
                const nameResult = await this.pool.query(nameQuery, [
                    contact.customerId,
                    contact.id,
                    `${contact.firstName} ${contact.lastName}`,
                    contact.firstName,
                    contact.lastName
                ]);
                duplicates.push(...nameResult.rows.map(row => ({
                    ...row,
                    matchType: 'name',
                    confidence: 'medium'
                })));
            }
        } catch (error) {
            logger.error('Error in Hubspot contact duplicate check:', error);
        }

        return this.deduplicateResults(duplicates);
    }

    async analyzeContactQuality(contact) {
        const issues = [];
        const warnings = [];
        let qualityScore = 100;

        // Critical Fields
        if (!contact.email && !contact.phone) {
            issues.push({
                field: 'contact_method',
                severity: 'high',
                message: 'No contact method (email or phone) provided'
            });
            qualityScore -= 30;
        }

        // Email check
        if (!contact.email) {
            warnings.push({
                field: 'email',
                severity: 'medium',
                message: 'Email address missing'
            });
            qualityScore -= 15;
        } else if (!this.isValidEmail(contact.email)) {
            issues.push({
                field: 'email',
                severity: 'high',
                message: 'Invalid email format'
            });
            qualityScore -= 20;
        }

        // Phone check
        if (!contact.phone) {
            warnings.push({
                field: 'phone',
                severity: 'medium',
                message: 'Phone number missing'
            });
            qualityScore -= 15;
        } else if (!this.isValidPhone(contact.phone)) {
            issues.push({
                field: 'phone',
                severity: 'high',
                message: 'Invalid phone format'
            });
            qualityScore -= 20;
        }

        // Name check
        if (!contact.firstName && !contact.lastName) {
            issues.push({
                field: 'name',
                severity: 'high',
                message: 'No name information provided'
            });
            qualityScore -= 25;
        }

        // HubSpot-specific fields
        if (!contact.lifecycleStage) {
            warnings.push({
                field: 'lifecycle_stage',
                severity: 'medium',
                message: 'Lifecycle stage not specified'
            });
            qualityScore -= 10;
        }

        if (!contact.leadStatus) {
            warnings.push({
                field: 'lead_status',
                severity: 'medium',
                message: 'Lead status not specified'
            });
            qualityScore -= 10;
        }

        return {
            entityId: contact.id,
            entityType: 'contact',
            qualityScore: Math.max(0, qualityScore),
            issues,
            warnings,
            lastChecked: new Date().toISOString()
        };
    }

    async analyzeProspectiveBuyerQuality(buyer) {
        const issues = [];
        const warnings = [];
        let qualityScore = 100;

        // HubSpot-specific buyer quality checks
        if (!buyer.dealStage) {
            issues.push({
                field: 'deal_stage',
                severity: 'high',
                message: 'Deal stage not specified'
            });
            qualityScore -= 25;
        }

        if (!buyer.amount) {
            warnings.push({
                field: 'amount',
                severity: 'medium',
                message: 'Deal amount not specified'
            });
            qualityScore -= 15;
        }

        if (!buyer.lastActivityDate) {
            warnings.push({
                field: 'last_activity',
                severity: 'medium',
                message: 'No recent activity recorded'
            });
            qualityScore -= 15;
        }

        return {
            entityId: buyer.id,
            entityType: 'prospective_buyer',
            qualityScore: Math.max(0, qualityScore),
            issues,
            warnings,
            lastChecked: new Date().toISOString()
        };
    }

    async analyzeEnquiryQuality(enquiry) {
        const issues = [];
        const warnings = [];
        let qualityScore = 100;

        // HubSpot-specific enquiry quality checks
        if (!enquiry.message) {
            issues.push({
                field: 'message',
                severity: 'high',
                message: 'No enquiry message provided'
            });
            qualityScore -= 30;
        } else if (enquiry.message.length < 10) {
            warnings.push({
                field: 'message',
                severity: 'medium',
                message: 'Very short enquiry message'
            });
            qualityScore -= 15;
        }

        if (!enquiry.source) {
            warnings.push({
                field: 'source',
                severity: 'medium',
                message: 'Enquiry source not specified'
            });
            qualityScore -= 15;
        }

        return {
            entityId: enquiry.id,
            entityType: 'enquiry',
            qualityScore: Math.max(0, qualityScore),
            issues,
            warnings,
            lastChecked: new Date().toISOString()
        };
    }
}

module.exports = new HubspotDataQualityAnalyzer(); 