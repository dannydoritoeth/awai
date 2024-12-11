const { BaseMetadataProcessor } = require('../baseMetadataProcessor');

class RelationshipMetadataProcessor extends BaseMetadataProcessor {
    processMetadata(record, relatedRecords = {}) {
        const {
            opportunities = [],
            contacts = [],
            accounts = [],
            campaigns = []
        } = relatedRecords;

        return {
            ...record,
            // Account relationship strength
            accountStrength: this._calculateAccountStrength(record, accounts),
            
            // Contact engagement metrics
            contactEngagement: this._calculateContactEngagement(record, contacts),
            
            // Deal velocity patterns
            dealVelocityPatterns: this._analyzeDealVelocity(record, opportunities),
            
            // Marketing influence patterns
            marketingPatterns: this._analyzeMarketingInfluence(record, campaigns),
            
            // Relationship network metrics
            networkStrength: this._calculateNetworkStrength(record, relatedRecords)
        };
    }

    _calculateAccountStrength(record, accounts) {
        const account = accounts.find(a => a.Id === record.AccountId);
        if (!account) return 0;

        return {
            lifetime_value: this._calculateLifetimeValue(account),
            relationship_duration: this._calculateRelationshipDuration(account),
            product_penetration: this._calculateProductPenetration(account),
            engagement_level: this._calculateEngagementLevel(account)
        };
    }

    _calculateContactEngagement(record, contacts) {
        const relevantContacts = contacts.filter(c => c.AccountId === record.AccountId);
        
        return {
            decision_makers: this._identifyDecisionMakers(relevantContacts),
            engagement_frequency: this._calculateEngagementFrequency(relevantContacts),
            last_engagement: this._getLastEngagement(relevantContacts),
            sentiment_score: this._calculateSentiment(relevantContacts)
        };
    }

    _analyzeDealVelocity(record, opportunities) {
        const accountOpportunities = opportunities.filter(o => o.AccountId === record.AccountId);
        
        return {
            avg_deal_cycle: this._calculateAvgDealCycle(accountOpportunities),
            stage_conversion_rates: this._calculateStageConversion(accountOpportunities),
            win_rate: this._calculateWinRate(accountOpportunities),
            deal_size_trend: this._analyzeDealSizeTrend(accountOpportunities)
        };
    }

    _analyzeMarketingInfluence(record, campaigns) {
        return {
            campaign_effectiveness: this._calculateCampaignEffectiveness(campaigns),
            channel_preference: this._determineChannelPreference(campaigns),
            content_engagement: this._analyzeContentEngagement(campaigns),
            response_rates: this._calculateResponseRates(campaigns)
        };
    }

    _calculateNetworkStrength(record, relatedRecords) {
        return {
            relationship_depth: this._calculateRelationshipDepth(record, relatedRecords),
            cross_sell_potential: this._calculateCrossSellPotential(record, relatedRecords),
            influence_score: this._calculateInfluenceScore(record, relatedRecords)
        };
    }
}

class OpportunityMetadataProcessor extends BaseMetadataProcessor {
    processMetadata(record) {
        const baseMetadata = super.processMetadata(record);
        
        return {
            ...baseMetadata,
            // Enhanced prediction features
            winPredictionFactors: this._calculateWinPredictionFactors(record),
            
            // Advanced velocity metrics
            velocityMetrics: this._calculateVelocityMetrics(record),
            
            // Competitive analysis
            competitivePosition: this._analyzeCompetitivePosition(record),
            
            // Risk assessment
            riskFactors: this._assessRiskFactors(record),
            
            // Deal complexity
            complexityScore: this._calculateComplexityScore(record)
        };
    }

    _calculateWinPredictionFactors(record) {
        return {
            historical_win_rate: this._getHistoricalWinRate(record),
            deal_size_factor: this._analyzeDealSize(record),
            stage_duration_impact: this._analyzeStageProgress(record),
            engagement_quality: this._assessEngagementQuality(record),
            competitive_factors: this._analyzeCompetitiveLandscape(record)
        };
    }

    _calculateVelocityMetrics(record) {
        return {
            stage_velocity: this._calculateStageVelocity(record),
            momentum_score: this._calculateMomentumScore(record),
            acceleration_rate: this._calculateAccelerationRate(record),
            bottleneck_risk: this._identifyBottlenecks(record)
        };
    }

    _analyzeCompetitivePosition(record) {
        return {
            strength_vs_competitors: this._assessCompetitiveStrength(record),
            differentiation_score: this._calculateDifferentiation(record),
            value_proposition_alignment: this._assessValueAlignment(record)
        };
    }

    _assessRiskFactors(record) {
        return {
            deal_size_risk: this._assessDealSizeRisk(record),
            stakeholder_risk: this._assessStakeholderRisk(record),
            competitive_risk: this._assessCompetitiveRisk(record),
            timeline_risk: this._assessTimelineRisk(record),
            budget_risk: this._assessBudgetRisk(record)
        };
    }

    _calculateComplexityScore(record) {
        return {
            stakeholder_complexity: this._assessStakeholderComplexity(record),
            technical_complexity: this._assessTechnicalComplexity(record),
            implementation_complexity: this._assessImplementationComplexity(record),
            integration_complexity: this._assessIntegrationComplexity(record)
        };
    }
}

class LeadScoreMetadataProcessor extends BaseMetadataProcessor {
    processMetadata(record) {
        const baseMetadata = super.processMetadata(record);
        
        return {
            ...baseMetadata,
            // Enhanced behavioral scoring
            behavioralScore: this._calculateBehavioralScore(record),
            
            // Firmographic scoring
            firmographicScore: this._calculateFirmographicScore(record),
            
            // Intent signals
            intentSignals: this._analyzeIntentSignals(record),
            
            // Engagement patterns
            engagementPatterns: this._analyzeEngagementPatterns(record),
            
            // Conversion probability
            conversionProbability: this._calculateConversionProbability(record)
        };
    }

    _calculateBehavioralScore(record) {
        return {
            website_engagement: this._analyzeWebsiteEngagement(record),
            content_consumption: this._analyzeContentConsumption(record),
            email_engagement: this._analyzeEmailEngagement(record),
            social_engagement: this._analyzeSocialEngagement(record)
        };
    }

    _calculateFirmographicScore(record) {
        return {
            industry_fit: this._calculateIndustryFit(record),
            company_size_fit: this._calculateCompanySizeFit(record),
            technology_fit: this._calculateTechnologyFit(record),
            budget_fit: this._calculateBudgetFit(record)
        };
    }
}

class CampaignInfluenceMetadataProcessor extends BaseMetadataProcessor {
    processMetadata(record) {
        return {
            ...record,
            // Normalize influence and revenue
            normalizedInfluence: parseFloat(record.Influence) / 100,
            normalizedRevenue: parseFloat(record.Revenue) || 0,
            
            // Calculate time-based metrics
            touchDuration: this._calculateTouchDuration(record),
            daysToConversion: this._calculateDaysToConversion(record),
            
            // Add time-based features
            seasonality: this._calculateSeasonality(record.FirstTouchDate),
            
            // Multi-touch attribution
            attributionModel: this._calculateAttribution(record)
        };
    }

    _calculateTouchDuration(record) {
        if (!record.FirstTouchDate || !record.LastTouchDate) return 0;
        const first = new Date(record.FirstTouchDate);
        const last = new Date(record.LastTouchDate);
        return Math.floor((last - first) / (1000 * 60 * 60 * 24));
    }

    _calculateDaysToConversion(record) {
        if (!record.FirstTouchDate || !record.CreatedDate) return 0;
        const first = new Date(record.FirstTouchDate);
        const conversion = new Date(record.CreatedDate);
        return Math.floor((conversion - first) / (1000 * 60 * 60 * 24));
    }

    _calculateSeasonality(date) {
        if (!date) return 'unknown';
        const month = new Date(date).getMonth();
        const seasons = {
            '0,1,2': 'Q1',
            '3,4,5': 'Q2',
            '6,7,8': 'Q3',
            '9,10,11': 'Q4'
        };
        return Object.entries(seasons).find(([months]) => 
            months.split(',').includes(month.toString()))?.[1] || 'unknown';
    }

    _calculateAttribution(record) {
        return {
            firstTouch: record.normalizedInfluence * 0.4,
            lastTouch: record.normalizedInfluence * 0.4,
            linear: record.normalizedInfluence / (record.touchDuration || 1)
        };
    }
}

module.exports = {
    RelationshipMetadataProcessor,
    OpportunityMetadataProcessor,
    LeadScoreMetadataProcessor,
    CampaignInfluenceMetadataProcessor
}; 