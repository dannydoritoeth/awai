const OpenAI = require('openai');
const logger = require('./logger');

class LeadScoringService {
    constructor(hubspotClient) {
        this.hubspotClient = hubspotClient;
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.weights = {
            leadFit: 0.3,
            engagement: 0.3,
            outcome: 0.2,
            recency: 0.2
        };
    }

    async scoreContact(contactId) {
        try {
            // Gather all relevant data
            const [
                contactWithCompany,
                engagementMetrics,
                dealHistory
            ] = await Promise.all([
                this.hubspotClient.getContactWithCompany(contactId),
                this.hubspotClient.getContactEngagementMetrics(contactId),
                this.hubspotClient.getContactDealHistory(contactId)
            ]);

            // Calculate component scores
            const leadFitScore = await this.calculateLeadFitScore(contactWithCompany);
            const engagementScore = this.calculateEngagementScore(engagementMetrics);
            const outcomeScore = this.calculateOutcomeScore(dealHistory);
            const recencyScore = this.calculateRecencyScore(engagementMetrics.lastEngagementDate);

            // Calculate final score
            const finalScore = Math.round(
                (leadFitScore * this.weights.leadFit) +
                (engagementScore * this.weights.engagement) +
                (outcomeScore * this.weights.outcome) +
                (recencyScore * this.weights.recency)
            );

            // Determine lead fit category
            const leadFit = this.getLeadFitCategory(finalScore);

            // Calculate close probability
            const closeProbability = await this.calculateCloseProbability(
                finalScore,
                dealHistory,
                contactWithCompany
            );

            // Determine next best action
            const nextBestAction = await this.determineNextBestAction(
                finalScore,
                engagementMetrics,
                dealHistory
            );

            const scoreData = {
                score: finalScore,
                leadFit,
                closeProbability,
                nextBestAction,
                factors: {
                    leadFitScore,
                    engagementScore,
                    outcomeScore,
                    recencyScore
                },
                metadata: {
                    industry: contactWithCompany.company?.industry,
                    companySize: contactWithCompany.company?.size,
                    source: contactWithCompany.source,
                    lastEngagement: engagementMetrics.lastEngagementDate,
                    totalEngagements: engagementMetrics.totalEngagements,
                    dealHistory: {
                        totalDeals: dealHistory.totalDeals,
                        wonDeals: dealHistory.wonDeals,
                        averageDealSize: dealHistory.averageDealSize
                    }
                },
                lastUpdated: new Date().toISOString(),
                version: process.env.LEAD_SCORE_MODEL_VERSION
            };

            // Update HubSpot
            await this.hubspotClient.updateLeadScore(contactId, scoreData);

            return scoreData;
        } catch (error) {
            logger.error('Error calculating lead score:', error);
            throw error;
        }
    }

    async calculateLeadFitScore(contactWithCompany) {
        try {
            const prompt = this.buildLeadFitPrompt(contactWithCompany);
            const completion = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert sales analyst. Score this lead\'s fit based on the provided data. Return only a number between 0 and 100.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 10
            });

            const score = parseInt(completion.choices[0].message.content.trim());
            return Math.min(100, Math.max(0, score));
        } catch (error) {
            logger.error('Error calculating lead fit score:', error);
            return 50; // Default score on error
        }
    }

    calculateEngagementScore(metrics) {
        const weights = {
            emailsOpened: 1,
            emailsReplied: 3,
            meetingsAttended: 5,
            callsAnswered: 4
        };

        const score = (
            (metrics.emailsOpened * weights.emailsOpened) +
            (metrics.emailsReplied * weights.emailsReplied) +
            (metrics.meetingsAttended * weights.meetingsAttended) +
            (metrics.callsAnswered * weights.callsAnswered)
        ) / metrics.totalEngagements;

        return Math.min(100, score * 10);
    }

    calculateOutcomeScore(dealHistory) {
        if (dealHistory.totalDeals === 0) return 50;

        const winRate = dealHistory.wonDeals / dealHistory.totalDeals;
        const valueScore = Math.min(100, (dealHistory.averageDealSize / 10000) * 10);
        
        return Math.round((winRate * 70) + (valueScore * 0.3));
    }

    calculateRecencyScore(lastEngagementDate) {
        if (!lastEngagementDate) return 0;

        const daysSinceLastEngagement = (new Date() - new Date(lastEngagementDate)) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastEngagement <= 1) return 100;
        if (daysSinceLastEngagement <= 7) return 80;
        if (daysSinceLastEngagement <= 30) return 60;
        if (daysSinceLastEngagement <= 90) return 40;
        if (daysSinceLastEngagement <= 180) return 20;
        
        return 0;
    }

    getLeadFitCategory(score) {
        if (score >= 80) return 'High';
        if (score >= 50) return 'Medium';
        return 'Low';
    }

    async calculateCloseProbability(score, dealHistory, contact) {
        try {
            const prompt = this.buildCloseProbabilityPrompt(score, dealHistory, contact);
            const completion = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert sales analyst. Calculate the probability of closing this lead based on the provided data. Return only a number between 0 and 100.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 10
            });

            const probability = parseInt(completion.choices[0].message.content.trim());
            return Math.min(100, Math.max(0, probability));
        } catch (error) {
            logger.error('Error calculating close probability:', error);
            return Math.round(score * 0.8); // Fallback calculation
        }
    }

    async determineNextBestAction(score, engagementMetrics, dealHistory) {
        try {
            const prompt = this.buildNextActionPrompt(score, engagementMetrics, dealHistory);
            const completion = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert sales analyst. Determine the next best action for this lead. Choose one: Follow-up, Nurture, or Close.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 10
            });

            const action = completion.choices[0].message.content.trim();
            return ['Follow-up', 'Nurture', 'Close'].includes(action) ? action : 'Nurture';
        } catch (error) {
            logger.error('Error determining next best action:', error);
            return score >= 80 ? 'Follow-up' : 'Nurture';
        }
    }

    buildLeadFitPrompt(contactWithCompany) {
        return `
            Analyze this lead's fit based on:
            Industry: ${contactWithCompany.company?.industry || 'Unknown'}
            Company Size: ${contactWithCompany.company?.size || 'Unknown'}
            Location: ${contactWithCompany.company?.country || 'Unknown'}
            Lead Source: ${contactWithCompany.source || 'Unknown'}
            Lifecycle Stage: ${contactWithCompany.lifecycleStage || 'Unknown'}
        `;
    }

    buildCloseProbabilityPrompt(score, dealHistory, contact) {
        return `
            Calculate close probability based on:
            Lead Score: ${score}
            Total Deals: ${dealHistory.totalDeals}
            Won Deals: ${dealHistory.wonDeals}
            Average Deal Size: ${dealHistory.averageDealSize}
            Industry: ${contact.company?.industry || 'Unknown'}
            Lead Stage: ${contact.lifecycleStage || 'Unknown'}
        `;
    }

    buildNextActionPrompt(score, engagementMetrics, dealHistory) {
        return `
            Determine next best action based on:
            Lead Score: ${score}
            Last Engagement: ${engagementMetrics.lastEngagementDate || 'Never'}
            Total Engagements: ${engagementMetrics.totalEngagements}
            Emails Replied: ${engagementMetrics.emailsReplied}
            Meetings Attended: ${engagementMetrics.meetingsAttended}
            Deal History: ${dealHistory.wonDeals} won, ${dealHistory.lostDeals} lost
        `;
    }
}

module.exports = LeadScoringService; 