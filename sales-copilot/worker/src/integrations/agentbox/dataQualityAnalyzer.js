const BaseDataQualityAnalyzer = require('../../services/baseDataQualityAnalyzer');
const { Pool } = require('pg');
const logger = require('../../services/logger');

class AgentboxDataQualityAnalyzer extends BaseDataQualityAnalyzer {
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
                    SELECT id, email, first_name, last_name, mobile
                    FROM agentbox_contacts
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

            // Check for mobile duplicates
            if (contact.mobile) {
                const mobileQuery = `
                    SELECT id, email, first_name, last_name, mobile
                    FROM agentbox_contacts
                    WHERE customer_id = $1
                    AND mobile = $2
                    AND id != $3
                `;
                const mobileResult = await this.pool.query(mobileQuery, [
                    contact.customerId,
                    this.normalizePhone(contact.mobile),
                    contact.id
                ]);
                duplicates.push(...mobileResult.rows.map(row => ({
                    ...row,
                    matchType: 'mobile',
                    confidence: 'high'
                })));
            }

            // Check for name similarity
            if (contact.firstName && contact.lastName) {
                const nameQuery = `
                    SELECT id, email, first_name, last_name, mobile
                    FROM agentbox_contacts
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
            logger.error('Error in Agentbox contact duplicate check:', error);
        }

        return this.deduplicateResults(duplicates);
    }

    async analyzeContactQuality(contact) {
        const issues = [];
        const warnings = [];
        let qualityScore = 100;

        // Critical Fields
        if (!contact.email && !contact.mobile) {
            issues.push({
                field: 'contact_method',
                severity: 'high',
                message: 'No contact method (email or mobile) provided'
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

        // Mobile check
        if (!contact.mobile) {
            warnings.push({
                field: 'mobile',
                severity: 'medium',
                message: 'Mobile number missing'
            });
            qualityScore -= 15;
        } else if (!this.isValidPhone(contact.mobile)) {
            issues.push({
                field: 'mobile',
                severity: 'high',
                message: 'Invalid mobile format'
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

        // Agentbox-specific fields
        if (!contact.source) {
            warnings.push({
                field: 'source',
                severity: 'low',
                message: 'Contact source not specified'
            });
            qualityScore -= 5;
        }

        if (!contact.type) {
            warnings.push({
                field: 'type',
                severity: 'low',
                message: 'Contact type not specified'
            });
            qualityScore -= 5;
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

        // Agentbox-specific buyer quality checks
        if (!buyer.interestLevel) {
            issues.push({
                field: 'interest_level',
                severity: 'high',
                message: 'Interest level not specified'
            });
            qualityScore -= 25;
        }

        if (!buyer.totalEnquiries && !buyer.totalInspections && !buyer.totalOffers) {
            issues.push({
                field: 'activity_tracking',
                severity: 'high',
                message: 'No activity history recorded'
            });
            qualityScore -= 30;
        }

        if (!buyer.priceFeedback) {
            warnings.push({
                field: 'price_feedback',
                severity: 'medium',
                message: 'No price feedback recorded'
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

        // Agentbox-specific enquiry quality checks
        if (!enquiry.comment) {
            issues.push({
                field: 'comment',
                severity: 'high',
                message: 'No enquiry message provided'
            });
            qualityScore -= 30;
        } else if (enquiry.comment.length < 10) {
            warnings.push({
                field: 'comment',
                severity: 'medium',
                message: 'Very short enquiry message'
            });
            qualityScore -= 15;
        }

        if (!enquiry.type) {
            issues.push({
                field: 'type',
                severity: 'high',
                message: 'Enquiry type not specified'
            });
            qualityScore -= 25;
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

module.exports = new AgentboxDataQualityAnalyzer(); 