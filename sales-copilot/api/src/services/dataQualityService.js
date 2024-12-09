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
    }

    async analyzeQuality(entityType, data, customerId) {
        try {
            // First get basic quality analysis
            const qualityReport = await this.getBasicQualityReport(entityType, data);

            // Then check for duplicates if customerId is provided
            if (customerId) {
                const duplicates = await this.findPotentialDuplicates(customerId, entityType, data);
                
                if (duplicates.length > 0) {
                    qualityReport.issues.push({
                        field: 'duplicate_check',
                        severity: 'high',
                        message: 'Potential duplicate records found',
                        duplicates: duplicates
                    });
                    qualityReport.qualityScore -= Math.min(30, duplicates.length * 10); // Reduce score for duplicates
                }
            }

            return {
                ...qualityReport,
                qualityScore: Math.max(0, qualityReport.qualityScore)
            };
        } catch (error) {
            logger.error('Error analyzing data quality:', error);
            throw error;
        }
    }

    async getBasicQualityReport(entityType, data) {
        switch(entityType) {
            case 'contact':
                return this.analyzeContactQuality(data);
            case 'prospective_buyer':
                return this.analyzeProspectiveBuyerQuality(data);
            case 'enquiry':
                return this.analyzeEnquiryQuality(data);
            default:
                throw new Error(`Unsupported entity type: ${entityType}`);
        }
    }

    async findPotentialDuplicates(customerId, entityType, data) {
        try {
            switch(entityType) {
                case 'contact':
                    return await this.findContactDuplicates(customerId, data);
                case 'prospective_buyer':
                    return await this.findProspectiveBuyerDuplicates(customerId, data);
                case 'enquiry':
                    return await this.findEnquiryDuplicates(customerId, data);
                default:
                    return [];
            }
        } catch (error) {
            logger.error('Error finding duplicates:', error);
            return [];
        }
    }

    async findContactDuplicates(customerId, contact) {
        const duplicates = [];
        if (!contact.id) return duplicates;

        try {
            // Check for email duplicates
            if (contact.email) {
                const emailQuery = `
                    SELECT id, email, first_name, last_name, mobile
                    FROM contacts
                    WHERE customer_id = $1
                    AND email = $2
                    AND id != $3
                `;
                const emailResult = await this.pool.query(emailQuery, [customerId, contact.email, contact.id]);
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
                    FROM contacts
                    WHERE customer_id = $1
                    AND mobile = $2
                    AND id != $3
                `;
                const mobileResult = await this.pool.query(mobileQuery, [
                    customerId, 
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
                    FROM contacts
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
                    customerId,
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
            logger.error('Error in contact duplicate check:', error);
        }

        return this.deduplicateResults(duplicates);
    }

    async findProspectiveBuyerDuplicates(customerId, buyer) {
        const duplicates = [];
        if (!buyer.id) return duplicates;

        try {
            // Check for same contact looking at same property
            if (buyer.contact?.id && buyer.property?.id) {
                const query = `
                    SELECT id, contact_id, property_id, interest_level
                    FROM prospective_buyers
                    WHERE customer_id = $1
                    AND contact_id = $2
                    AND property_id = $3
                    AND id != $4
                `;
                const result = await this.pool.query(query, [
                    customerId,
                    buyer.contact.id,
                    buyer.property.id,
                    buyer.id
                ]);
                duplicates.push(...result.rows.map(row => ({
                    ...row,
                    matchType: 'contact_property',
                    confidence: 'high'
                })));
            }
        } catch (error) {
            logger.error('Error in prospective buyer duplicate check:', error);
        }

        return duplicates;
    }

    async findEnquiryDuplicates(customerId, enquiry) {
        const duplicates = [];
        if (!buyer.id) return duplicates;

        try {
            // Check for duplicate enquiries within 24 hours
            if (enquiry.contact?.id && enquiry.property?.id) {
                const query = `
                    SELECT id, contact_id, property_id, comment, created_at
                    FROM enquiries
                    WHERE customer_id = $1
                    AND contact_id = $2
                    AND property_id = $3
                    AND id != $4
                    AND created_at >= NOW() - INTERVAL '24 hours'
                `;
                const result = await this.pool.query(query, [
                    customerId,
                    enquiry.contact.id,
                    enquiry.property.id,
                    enquiry.id
                ]);
                duplicates.push(...result.rows.map(row => ({
                    ...row,
                    matchType: 'recent_enquiry',
                    confidence: 'high'
                })));
            }

            // Check for similar content
            if (enquiry.comment) {
                const contentQuery = `
                    SELECT id, contact_id, property_id, comment, created_at
                    FROM enquiries
                    WHERE customer_id = $1
                    AND id != $2
                    AND SIMILARITY(comment, $3) > 0.7
                    AND created_at >= NOW() - INTERVAL '24 hours'
                `;
                const contentResult = await this.pool.query(contentQuery, [
                    customerId,
                    enquiry.id,
                    enquiry.comment
                ]);
                duplicates.push(...contentResult.rows.map(row => ({
                    ...row,
                    matchType: 'similar_content',
                    confidence: 'medium'
                })));
            }
        } catch (error) {
            logger.error('Error in enquiry duplicate check:', error);
        }

        return this.deduplicateResults(duplicates);
    }

    deduplicateResults(duplicates) {
        // Remove duplicates based on ID and keep highest confidence match
        const uniqueDuplicates = {};
        
        for (const duplicate of duplicates) {
            const existingDuplicate = uniqueDuplicates[duplicate.id];
            
            if (!existingDuplicate || 
                this.getConfidenceScore(duplicate.confidence) > 
                this.getConfidenceScore(existingDuplicate.confidence)) {
                uniqueDuplicates[duplicate.id] = duplicate;
            }
        }

        return Object.values(uniqueDuplicates);
    }

    getConfidenceScore(confidence) {
        const scores = {
            'high': 3,
            'medium': 2,
            'low': 1
        };
        return scores[confidence] || 0;
    }

    normalizePhone(phone) {
        // Remove all non-numeric characters
        return phone.replace(/\D/g, '');
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

        // Individual Field Checks
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

        if (!contact.firstName && !contact.lastName) {
            issues.push({
                field: 'name',
                severity: 'high',
                message: 'No name information provided'
            });
            qualityScore -= 25;
        }

        // Optional but Important Fields
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

        // Critical Fields
        if (!buyer.interestLevel) {
            issues.push({
                field: 'interest_level',
                severity: 'high',
                message: 'Interest level not specified'
            });
            qualityScore -= 25;
        }

        // Activity Tracking
        if (!buyer.totalEnquiries && !buyer.totalInspections && !buyer.totalOffers) {
            issues.push({
                field: 'activity_tracking',
                severity: 'high',
                message: 'No activity history recorded'
            });
            qualityScore -= 30;
        }

        // Price Information
        if (!buyer.priceFeedback) {
            warnings.push({
                field: 'price_feedback',
                severity: 'medium',
                message: 'No price feedback recorded'
            });
            qualityScore -= 15;
        }

        // Status Fields
        const statusFields = ['contractTaken', 'reportTaken', 'ongoingInterest'];
        const missingStatus = statusFields.filter(field => buyer[field] === undefined);
        if (missingStatus.length > 0) {
            warnings.push({
                field: 'status_tracking',
                severity: 'medium',
                message: `Missing status for: ${missingStatus.join(', ')}`
            });
            qualityScore -= (10 * missingStatus.length);
        }

        // Activity Dates
        if (!buyer.lastActivityDate) {
            warnings.push({
                field: 'last_activity',
                severity: 'medium',
                message: 'Last activity date not recorded'
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

        // Critical Fields
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

        // Relationships
        if (!enquiry.contact) {
            issues.push({
                field: 'contact',
                severity: 'high',
                message: 'No contact associated with enquiry'
            });
            qualityScore -= 25;
        }

        if (!enquiry.property) {
            issues.push({
                field: 'property',
                severity: 'high',
                message: 'No property associated with enquiry'
            });
            qualityScore -= 25;
        }

        // Optional Fields
        if (!enquiry.origin) {
            warnings.push({
                field: 'origin',
                severity: 'low',
                message: 'Enquiry source not specified'
            });
            qualityScore -= 10;
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

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidPhone(phone) {
        // Basic Australian mobile format check
        const phoneRegex = /^(?:\+61|0)[4-5]\d{8}$/;
        return phoneRegex.test(phone.replace(/\s+/g, ''));
    }

    async storeQualityReport(customerId, report) {
        const query = `
            INSERT INTO data_quality_reports (
                customer_id,
                entity_id,
                entity_type,
                quality_score,
                issues,
                warnings,
                last_checked
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (customer_id, entity_id, entity_type)
            DO UPDATE SET
                quality_score = $4,
                issues = $5,
                warnings = $6,
                last_checked = $7
        `;

        await this.pool.query(query, [
            customerId,
            report.entityId,
            report.entityType,
            report.qualityScore,
            JSON.stringify(report.issues),
            JSON.stringify(report.warnings),
            report.lastChecked
        ]);
    }

    async getQualityReport(customerId, entityId, entityType) {
        const query = `
            SELECT *
            FROM data_quality_reports
            WHERE customer_id = $1
            AND entity_id = $2
            AND entity_type = $3
        `;

        const result = await this.pool.query(query, [customerId, entityId, entityType]);
        return result.rows[0] || null;
    }

    async getCustomerQualityReports(customerId, entityType = null, minQualityScore = null) {
        let query = `
            SELECT *
            FROM data_quality_reports
            WHERE customer_id = $1
        `;
        const params = [customerId];

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