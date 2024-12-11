const { Pool } = require('pg');
const logger = require('../../services/logger');
const { ChatOpenAI } = require('langchain/chat_models');
const { PromptTemplate } = require('langchain/prompts');
const { LLMChain } = require('langchain/chains');

class ScoringService {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
        });

        // Initialize LangChain
        this.llm = new ChatOpenAI({
            temperature: 0.1,
            modelName: 'gpt-3.5-turbo',
            maxTokens: 500
        });

        this.initializePrompts();
    }

    initializePrompts() {
        this.contactAnalysisPrompt = PromptTemplate.fromTemplate(`
            Analyze this contact/lead and identify the key positive and negative factors affecting their likelihood to engage.
            Contact details: {leadData}
            
            Provide analysis in JSON format with these fields:
            {
                "score": number between 1-99,
                "topPositives": [
                    {
                        "factor": "string",
                        "value": "string",
                        "impact": "high/medium/low"
                    }
                ],
                "topNegatives": [
                    {
                        "factor": "string",
                        "value": "string",
                        "impact": "high/medium/low"
                    }
                ],
                "suggestedActions": [
                    "string"
                ]
            }

            Focus on factors like:
            - Contact Source
            - Contact Class
            - Interest Level
            - Engagement History
            - Property Type Preferences
            - Region/Location
            - Communication History
            - Data Completeness
        `);

        this.prospectiveBuyerAnalysisPrompt = PromptTemplate.fromTemplate(`
            Analyze this prospective buyer and identify the key positive and negative factors affecting their likelihood to purchase.
            Buyer details: {oppData}
            
            Provide analysis in JSON format with these fields:
            {
                "score": number between 1-99,
                "topPositives": [
                    {
                        "factor": "string",
                        "value": "string",
                        "impact": "high/medium/low"
                    }
                ],
                "topNegatives": [
                    {
                        "factor": "string",
                        "value": "string",
                        "impact": "high/medium/low"
                    }
                ],
                "suggestedActions": [
                    "string"
                ]
            }

            Focus on factors like:
            - Total Enquiries
            - Total Inspections
            - Total Offers
            - Interest Level
            - Price Feedback
            - Contract Status
            - Report Status
            - Ongoing Interest
            - Activity Recency
            - Follow-up Status
        `);

        this.enquiryAnalysisPrompt = PromptTemplate.fromTemplate(`
            Analyze this property enquiry and identify the key positive and negative factors affecting its quality and likelihood of conversion.
            Enquiry details: {enquiryData}
            
            Provide analysis in JSON format with these fields:
            {
                "score": number between 1-99,
                "topPositives": [
                    {
                        "factor": "string",
                        "value": "string",
                        "impact": "high/medium/low"
                    }
                ],
                "topNegatives": [
                    {
                        "factor": "string",
                        "value": "string",
                        "impact": "high/medium/low"
                    }
                ],
                "suggestedActions": [
                    "string"
                ]
            }

            Focus on factors like:
            - Enquiry Type
            - Message Content Quality
            - Property Match
            - Contact Details
            - Response Time Needed
            - Budget Indication
            - Inspection Request
            - Documentation Request
            - Source Quality
            - Time of Day
        `);
    }

    async calculateScore(customerId, entityType, data) {
        try {
            // Get quick rule-based score first
            const ruleBasedResult = await this.computeRuleBasedScore(entityType, data);
            
            // Start LLM analysis in parallel
            const llmAnalysisPromise = this.getLLMAnalysis(entityType, data);
            
            // Store initial score
            await this.storeScore(customerId, data.id, entityType, ruleBasedResult.score, {
                ...ruleBasedResult.factors,
                analysisStatus: 'pending'
            });

            try {
                // Wait for LLM analysis with timeout
                const llmAnalysis = await Promise.race([
                    llmAnalysisPromise,
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('LLM timeout')), 10000)
                    )
                ]);

                // Format the analysis for display
                const formattedAnalysis = this.formatAnalysisForDisplay(llmAnalysis);

                // Combine scores and store updated result
                const finalScore = this.combineScores(ruleBasedResult.score, llmAnalysis.score);
                const enrichedFactors = {
                    ...ruleBasedResult.factors,
                    einsteinAnalysis: formattedAnalysis,
                    analysisStatus: 'completed'
                };

                await this.storeScore(customerId, data.id, entityType, finalScore, enrichedFactors);

                return {
                    score: finalScore,
                    factors: enrichedFactors
                };

            } catch (llmError) {
                logger.warn('LLM analysis failed or timed out:', llmError);
                return {
                    score: ruleBasedResult.score,
                    factors: {
                        ...ruleBasedResult.factors,
                        analysisStatus: 'failed',
                        analysisError: llmError.message
                    }
                };
            }

        } catch (error) {
            logger.error('Error calculating score:', error);
            throw error;
        }
    }

    formatAnalysisForDisplay(analysis) {
        return {
            score: analysis.score,
            topPositives: analysis.topPositives.map(p => `${p.factor} is ${p.value}`),
            topNegatives: analysis.topNegatives.map(n => `${n.factor} is ${n.value}`),
            suggestedActions: analysis.suggestedActions
        };
    }

    async computeRuleBasedScore(entityType, data) {
        switch(entityType) {
            case 'contact':
                return this.calculateContactScore(data);
            case 'prospective_buyer':
                return this.calculateProspectiveBuyerScore(data);
            case 'enquiry':
                return this.calculateEnquiryScore(data);
            default:
                throw new Error(`Unsupported entity type: ${entityType}`);
        }
    }

    async getLLMAnalysis(entityType, data) {
        let prompt;
        let dataField;

        switch(entityType) {
            case 'contact':
                prompt = this.contactAnalysisPrompt;
                dataField = 'leadData';
                break;
            case 'prospective_buyer':
                prompt = this.prospectiveBuyerAnalysisPrompt;
                dataField = 'oppData';
                break;
            case 'enquiry':
                prompt = this.enquiryAnalysisPrompt;
                dataField = 'enquiryData';
                break;
            default:
                throw new Error(`Unsupported entity type: ${entityType}`);
        }

        const chain = new LLMChain({
            llm: this.llm,
            prompt: prompt
        });

        const result = await chain.call({
            [dataField]: JSON.stringify(data)
        });

        try {
            return JSON.parse(result.text);
        } catch (e) {
            logger.error('Failed to parse LLM response:', e);
            throw new Error('Invalid LLM response format');
        }
    }

    combineScores(ruleScore, llmScore) {
        // Weight rule-based score more heavily (70/30 split)
        const combinedScore = (ruleScore * 0.7) + (llmScore * 0.3);
        return Math.min(99, Math.max(1, Math.round(combinedScore)));
    }

    async calculateContactScore(contact) {
        const factors = {};
        let score = 50; // Base score

        // Data completeness (20 points)
        if (contact.email) {
            score += 10;
            factors.hasEmail = true;
        }
        if (contact.mobile) {
            score += 10;
            factors.hasMobile = true;
        }

        // Contact class quality (15 points)
        if (contact.contactClass) {
            const classScores = {
                'VIP': 15,
                'Premium': 12,
                'Standard': 8
            };
            if (classScores[contact.contactClass]) {
                score += classScores[contact.contactClass];
                factors.contactClass = contact.contactClass;
            }
        }

        // Interest level (15 points)
        if (contact.interestLevel) {
            const interestScores = {
                'Hot': 15,
                'Warm': 10,
                'Cold': 5
            };
            if (interestScores[contact.interestLevel]) {
                score += interestScores[contact.interestLevel];
                factors.interestLevel = contact.interestLevel;
            }
        }

        // Recent activity (10 points)
        if (contact.lastActivityDate) {
            const daysSinceActivity = this.getDaysSince(contact.lastActivityDate);
            if (daysSinceActivity < 7) {
                score += 10;
                factors.recentActivity = true;
            }
        }

        return {
            score: Math.min(99, Math.max(1, score)),
            factors
        };
    }

    async calculateProspectiveBuyerScore(buyer) {
        const factors = {};
        let score = 50; // Base score

        // Engagement metrics (30 points)
        let engagementScore = 0;
        if (buyer.totalEnquiries > 0) engagementScore += 10;
        if (buyer.totalInspections > 0) engagementScore += 10;
        if (buyer.totalOffers > 0) engagementScore += 10;
        score += Math.min(30, engagementScore);
        factors.engagementLevel = engagementScore >= 20 ? 'High' : engagementScore >= 10 ? 'Medium' : 'Low';

        // Interest indicators (20 points)
        let interestScore = 0;
        if (buyer.contractTaken) interestScore += 10;
        if (buyer.reportTaken) interestScore += 5;
        if (buyer.ongoingInterest) interestScore += 5;
        score += interestScore;
        factors.interestIndicators = {
            contractTaken: buyer.contractTaken,
            reportTaken: buyer.reportTaken,
            ongoingInterest: buyer.ongoingInterest
        };

        // Activity recency (10 points)
        if (buyer.lastActivityDate) {
            const daysSinceActivity = this.getDaysSince(buyer.lastActivityDate);
            if (daysSinceActivity < 7) {
                score += 10;
                factors.recentActivity = true;
            }
        }

        // Price feedback (10 points)
        if (buyer.priceFeedback) {
            score += 10;
            factors.hasPriceFeedback = true;
        }

        return {
            score: Math.min(99, Math.max(1, score)),
            factors
        };
    }

    async calculateEnquiryScore(enquiry) {
        const factors = {};
        let score = 50; // Base score

        // Message content (20 points)
        if (enquiry.comment) {
            const commentLength = enquiry.comment.length;
            if (commentLength > 200) {
                score += 20;
                factors.detailedMessage = true;
            } else if (commentLength > 100) {
                score += 10;
                factors.adequateMessage = true;
            }
        }

        // Enquiry type quality (15 points)
        const typeScores = {
            'Buyer Enquiry': 15,
            'Inspection Request': 15,
            'Documentation Request': 10,
            'General Enquiry': 5
        };
        if (enquiry.type && typeScores[enquiry.type]) {
            score += typeScores[enquiry.type];
            factors.enquiryType = enquiry.type;
        }

        // Source quality (15 points)
        const sourceScores = {
            'Direct Website': 15,
            'Property Portal': 12,
            'Social Media': 8,
            'Other': 5
        };
        if (enquiry.origin && sourceScores[enquiry.origin]) {
            score += sourceScores[enquiry.origin];
            factors.sourceQuality = enquiry.origin;
        }

        // Contact relationship (10 points)
        if (enquiry.contact) {
            score += 10;
            factors.hasContact = true;
        }

        // Property relationship (10 points)
        if (enquiry.property) {
            score += 10;
            factors.hasProperty = true;
        }

        // Timing factors (10 points)
        if (enquiry.date) {
            const enquiryDate = new Date(enquiry.date);
            const hour = enquiryDate.getHours();
            
            // Business hours bonus
            if (hour >= 9 && hour <= 17) {
                score += 5;
                factors.businessHours = true;
            }

            // Recency bonus
            const daysSince = this.getDaysSince(enquiry.date);
            if (daysSince < 1) {
                score += 5;
                factors.veryRecent = true;
            }
        }

        // Response urgency (-10 to +10 points)
        const daysSinceCreated = enquiry.firstCreated ? 
            this.getDaysSince(enquiry.firstCreated) : 0;

        if (daysSinceCreated === 0) {
            score += 10; // Needs immediate attention
            factors.needsUrgentResponse = true;
        } else if (daysSinceCreated > 2) {
            score -= 10; // Overdue response
            factors.overdueResponse = true;
        }

        return {
            score: Math.min(99, Math.max(1, score)),
            factors
        };
    }

    async storeScore(customerId, entityId, entityType, score, factors) {
        const query = `
            INSERT INTO entity_scores (customer_id, entity_id, entity_type, score, factors)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (customer_id, entity_id, entity_type)
            DO UPDATE SET 
                score = $4,
                factors = $5,
                last_updated = CURRENT_TIMESTAMP
        `;

        await this.pool.query(query, [
            customerId,
            entityId,
            entityType,
            score,
            factors
        ]);
    }

    async getScore(customerId, entityId, entityType) {
        const query = `
            SELECT score, factors, last_updated
            FROM entity_scores
            WHERE customer_id = $1 AND entity_id = $2 AND entity_type = $3
        `;

        const result = await this.pool.query(query, [customerId, entityId, entityType]);
        return result.rows[0] || null;
    }

    async getCustomerScores(customerId, entityType = null) {
        let query = `
            SELECT entity_id, entity_type, score, factors, last_updated
            FROM entity_scores
            WHERE customer_id = $1
        `;
        const params = [customerId];

        if (entityType) {
            query += ` AND entity_type = $2`;
            params.push(entityType);
        }

        query += ` ORDER BY score DESC`;
        
        const result = await this.pool.query(query, params);
        return result.rows;
    }

    getDaysSince(date) {
        return Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24));
    }
}

module.exports = new ScoringService(); 