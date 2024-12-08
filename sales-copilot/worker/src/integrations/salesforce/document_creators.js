const { BaseDocumentCreator } = require('../baseDocumentCreator');
const { Document } = require('langchain/document');
const {
    OpportunityMetadataProcessor,
    LeadScoreMetadataProcessor,
    CampaignInfluenceMetadataProcessor
} = require('./metadata_processors');

class OpportunityHistoryDocumentCreator extends BaseDocumentCreator {
    constructor() {
        super('opportunity_history');
        this.metadataProcessor = new OpportunityMetadataProcessor();
    }

    async createDocuments(records) {
        return records.map(record => {
            const metadata = this.metadataProcessor.processMetadata(record);
            
            // Enhanced content for AI analysis
            const content = `Opportunity ${record.OpportunityId} analysis:
                Stage Change: ${record.Field === 'StageName' ? `Changed from ${record.OldValue} to ${record.NewValue}` : 'No stage change'}
                Current Stage: ${record.StageName} (Category: ${metadata.stageCategory})
                Days in Current Stage: ${metadata.daysInStage}
                Stage Velocity: ${metadata.stageVelocity.toFixed(2)}
                
                Financial Metrics:
                - Amount: ${metadata.amount}
                - Expected Revenue: ${metadata.expectedRevenue}
                - Probability: ${metadata.probability}%
                
                Temporal Analysis:
                - Created in Q${metadata.createdQuarter}
                - Month: ${metadata.createdMonth}
                - Day of Week: ${metadata.dayOfWeek}
                
                This update was made by ${record.CreatedById} on ${record.CreatedDate}.
                The opportunity is currently in the ${metadata.stageCategory} stage of the sales cycle.`;

            return new Document({ pageContent: content, metadata });
        });
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
            
            const content = `Lead ${record.LeadId} scoring analysis:
                Score: ${metadata.normalizedScore * 100}% (Grade: ${record.Grade}, Value: ${metadata.gradeValue})
                Category: ${metadata.reasonCategory}
                
                Scoring Factors:
                - Primary Reason: ${record.Reason}
                - Category: ${metadata.reasonCategory}
                
                Temporal Analysis:
                - Scored in Q${metadata.createdQuarter}
                - Month: ${metadata.createdMonth}
                
                Model ${record.ModelId} generated this score on ${record.CreatedDate}.
                The lead's quality is categorized as ${metadata.gradeValue >= 3 ? 'high' : metadata.gradeValue >= 2 ? 'medium' : 'low'} 
                based on the grading scale.`;

            return new Document({ pageContent: content, metadata });
        });
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