const { BaseDocumentCreator } = require('../baseDocumentCreator');
const { Document } = require('langchain/document');
const {
    RelationshipMetadataProcessor,
    OpportunityMetadataProcessor,
    LeadScoreMetadataProcessor,
    CampaignInfluenceMetadataProcessor
} = require('./metadata_processors');

class OpportunityHistoryDocumentCreator extends BaseDocumentCreator {
    constructor() {
        super('opportunity_history');
        this.metadataProcessor = new OpportunityMetadataProcessor();
        this.relationshipProcessor = new RelationshipMetadataProcessor();
    }

    async createDocuments(records, relatedRecords) {
        return records.map(record => {
            const metadata = this.metadataProcessor.processMetadata(record);
            const relationshipData = this.relationshipProcessor.processMetadata(record, relatedRecords);
            
            const content = `Opportunity ${record.OpportunityId} comprehensive analysis:
                Stage Analysis:
                - Current Stage: ${record.StageName} (${metadata.velocityMetrics.stage_velocity.toFixed(2)} velocity)
                - Momentum Score: ${metadata.velocityMetrics.momentum_score.toFixed(2)}
                - Bottleneck Risk: ${metadata.velocityMetrics.bottleneck_risk}
                
                Win Prediction:
                - Historical Win Rate: ${metadata.winPredictionFactors.historical_win_rate}%
                - Deal Size Impact: ${metadata.winPredictionFactors.deal_size_factor}
                - Engagement Quality: ${metadata.winPredictionFactors.engagement_quality}
                
                Risk Assessment:
                - Overall Risk Level: ${this._calculateOverallRisk(metadata.riskFactors)}
                - Key Risks: ${this._formatKeyRisks(metadata.riskFactors)}
                
                Competitive Position:
                - Strength vs Competitors: ${metadata.competitivePosition.strength_vs_competitors}
                - Value Proposition Alignment: ${metadata.competitivePosition.value_proposition_alignment}
                
                Relationship Strength:
                - Account Lifetime Value: ${relationshipData.accountStrength.lifetime_value}
                - Decision Maker Engagement: ${relationshipData.contactEngagement.decision_makers.length} key stakeholders
                - Network Influence Score: ${relationshipData.networkStrength.influence_score}
                
                Deal Complexity:
                - Stakeholder Complexity: ${metadata.complexityScore.stakeholder_complexity}
                - Technical Complexity: ${metadata.complexityScore.technical_complexity}
                - Implementation Risk: ${metadata.complexityScore.implementation_complexity}
                
                Next Best Actions:
                ${this._generateNextBestActions(metadata, relationshipData)}`;

            return new Document({
                pageContent: content,
                metadata: {
                    ...metadata,
                    relationships: relationshipData
                }
            });
        });
    }

    _calculateOverallRisk(riskFactors) {
        const riskScores = Object.values(riskFactors);
        const avgRisk = riskScores.reduce((a, b) => a + b, 0) / riskScores.length;
        return avgRisk > 0.7 ? 'High' : avgRisk > 0.4 ? 'Medium' : 'Low';
    }

    _formatKeyRisks(riskFactors) {
        return Object.entries(riskFactors)
            .filter(([_, score]) => score > 0.6)
            .map(([risk]) => risk.replace('_risk', ''))
            .join(', ');
    }

    _generateNextBestActions(metadata, relationshipData) {
        const actions = [];
        
        if (metadata.velocityMetrics.bottleneck_risk > 0.6) {
            actions.push('- Escalate to sales management for bottleneck resolution');
        }
        
        if (relationshipData.contactEngagement.decision_makers.length < 2) {
            actions.push('- Identify and engage additional decision makers');
        }
        
        if (metadata.competitivePosition.strength_vs_competitors < 0.5) {
            actions.push('- Strengthen competitive differentiation');
        }
        
        return actions.join('\n');
    }
}

class LeadScoreDocumentCreator extends BaseDocumentCreator {
    constructor() {
        super('lead_score');
        this.metadataProcessor = new LeadScoreMetadataProcessor();
    }

    async createDocuments(records) {
        return records.map(record => {
            const metadata = this.metadataProcessor.processMetadata(record);
            
            const content = `Lead ${record.LeadId} comprehensive scoring analysis:
                Overall Scores:
                - Behavioral Score: ${this._formatScore(metadata.behavioralScore)}
                - Firmographic Score: ${this._formatScore(metadata.firmographicScore)}
                - Conversion Probability: ${(metadata.conversionProbability * 100).toFixed(1)}%
                
                Engagement Analysis:
                - Website Activity: ${metadata.behavioralScore.website_engagement}
                - Content Consumption: ${metadata.behavioralScore.content_consumption}
                - Email Engagement: ${metadata.behavioralScore.email_engagement}
                - Social Engagement: ${metadata.behavioralScore.social_engagement}
                
                Company Fit:
                - Industry Alignment: ${metadata.firmographicScore.industry_fit}
                - Company Size Fit: ${metadata.firmographicScore.company_size_fit}
                - Technology Stack: ${metadata.firmographicScore.technology_fit}
                - Budget Alignment: ${metadata.firmographicScore.budget_fit}
                
                Intent Signals:
                ${this._formatIntentSignals(metadata.intentSignals)}
                
                Engagement Patterns:
                ${this._formatEngagementPatterns(metadata.engagementPatterns)}
                
                Recommended Actions:
                ${this._generateRecommendations(metadata)}`;

            return new Document({
                pageContent: content,
                metadata
            });
        });
    }

    _formatScore(scoreObject) {
        const avgScore = Object.values(scoreObject).reduce((a, b) => a + b, 0) / Object.values(scoreObject).length;
        return (avgScore * 100).toFixed(1) + '%';
    }

    _formatIntentSignals(signals) {
        return Object.entries(signals)
            .map(([signal, strength]) => `- ${signal}: ${strength > 0.7 ? 'Strong' : strength > 0.4 ? 'Medium' : 'Weak'}`)
            .join('\n');
    }

    _formatEngagementPatterns(patterns) {
        return Object.entries(patterns)
            .map(([pattern, details]) => `- ${pattern}: ${details}`)
            .join('\n');
    }

    _generateRecommendations(metadata) {
        const recommendations = [];
        
        if (metadata.behavioralScore.website_engagement < 0.3) {
            recommendations.push('- Increase website engagement through targeted content');
        }
        
        if (metadata.firmographicScore.industry_fit > 0.7 && metadata.conversionProbability > 0.6) {
            recommendations.push('- Fast-track for sales engagement');
        }
        
        if (metadata.behavioralScore.content_consumption > 0.7) {
            recommendations.push('- Provide advanced stage content');
        }
        
        return recommendations.join('\n');
    }
}

class CampaignInfluenceDocumentCreator extends BaseDocumentCreator {
    constructor() {
        super('campaign_influence');
        this.metadataProcessor = new CampaignInfluenceMetadataProcessor();
    }

    async createDocuments(records) {
        return records.map(record => {
            const metadata = this.metadataProcessor.processMetadata(record);
            
            const content = `Campaign ${record.CampaignId} influence analysis:
                Influence on Opportunity ${record.OpportunityId}:
                - Influence Score: ${metadata.normalizedInfluence * 100}%
                - Attributed Revenue: ${metadata.normalizedRevenue}
                
                Engagement Timeline:
                - First Touch: ${record.FirstTouchDate}
                - Last Touch: ${record.LastTouchDate}
                - Touch Duration: ${metadata.touchDuration} days
                - Days to Conversion: ${metadata.daysToConversion} days
                
                Attribution Analysis:
                - First Touch Attribution: ${metadata.attributionModel.firstTouch.toFixed(2)}%
                - Last Touch Attribution: ${metadata.attributionModel.lastTouch.toFixed(2)}%
                - Linear Attribution: ${metadata.attributionModel.linear.toFixed(2)}%
                
                Seasonality: ${metadata.seasonality}
                
                This campaign influenced Contact ${record.ContactId} through multiple touchpoints,
                resulting in a ${metadata.touchDuration}-day engagement period.`;

            return new Document({ pageContent: content, metadata });
        });
    }
}

module.exports = {
    OpportunityHistoryDocumentCreator,
    LeadScoreDocumentCreator,
    CampaignInfluenceDocumentCreator
}; 