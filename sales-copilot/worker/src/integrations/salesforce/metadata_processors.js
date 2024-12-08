const { BaseMetadataProcessor } = require('../baseMetadataProcessor');

class OpportunityMetadataProcessor extends BaseMetadataProcessor {
    processMetadata(record) {
        return {
            ...record,
            // Normalize numerical values
            amount: parseFloat(record.Amount) || 0,
            probability: parseFloat(record.Probability) || 0,
            expectedRevenue: parseFloat(record.ExpectedRevenue) || 0,
            
            // Calculate derived metrics
            daysInStage: this._calculateDaysInStage(record),
            stageVelocity: this._calculateStageVelocity(record),
            
            // Categorize stages for pattern matching
            stageCategory: this._categorizeStage(record.StageName),
            
            // Add time-based features
            createdMonth: new Date(record.CreatedDate).getMonth() + 1,
            createdQuarter: Math.floor(new Date(record.CreatedDate).getMonth() / 3) + 1,
            dayOfWeek: new Date(record.CreatedDate).getDay()
        };
    }

    _calculateDaysInStage(record) {
        if (!record.CreatedDate) return 0;
        const created = new Date(record.CreatedDate);
        const now = new Date();
        return Math.floor((now - created) / (1000 * 60 * 60 * 24));
    }

    _calculateStageVelocity(record) {
        const daysInStage = this._calculateDaysInStage(record);
        return daysInStage > 0 ? (record.Probability / daysInStage) : 0;
    }

    _categorizeStage(stageName) {
        const stageCategories = {
            'Prospecting': 'early',
            'Qualification': 'early',
            'Needs Analysis': 'early',
            'Value Proposition': 'middle',
            'Id. Decision Makers': 'middle',
            'Proposal/Price Quote': 'late',
            'Negotiation/Review': 'late',
            'Closed Won': 'won',
            'Closed Lost': 'lost'
        };
        return stageCategories[stageName] || 'unknown';
    }
}

class LeadScoreMetadataProcessor extends BaseMetadataProcessor {
    processMetadata(record) {
        return {
            ...record,
            // Normalize scores
            normalizedScore: parseFloat(record.Score) / 100,
            
            // Convert grade to numerical value
            gradeValue: this._convertGradeToValue(record.Grade),
            
            // Categorize reasons for pattern matching
            reasonCategory: this._categorizeReason(record.Reason),
            
            // Add time-based features
            createdMonth: new Date(record.CreatedDate).getMonth() + 1,
            createdQuarter: Math.floor(new Date(record.CreatedDate).getMonth() / 3) + 1
        };
    }

    _convertGradeToValue(grade) {
        const gradeValues = { 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'F': 0 };
        return gradeValues[grade] || 0;
    }

    _categorizeReason(reason) {
        const categories = {
            'High Engagement': 'engagement',
            'Company Size': 'firmographic',
            'Industry Match': 'firmographic',
            'Budget Confirmed': 'qualification',
            'Multiple Stakeholders': 'engagement'
        };
        return categories[reason] || 'other';
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
    OpportunityMetadataProcessor,
    LeadScoreMetadataProcessor,
    CampaignInfluenceMetadataProcessor
}; 