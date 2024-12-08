const SalesforceDocumentCreator = require('./documentCreator');
const BaseEntityProcessor = require('../baseEntityProcessor');
const BaseMetadataCreator = require('../baseMetadataCreator');

class SalesforceMetadataCreator extends BaseMetadataCreator {
    static getSource() {
        return 'salesforce';
    }

    static createOpportunityMetadata(opportunity, integration) {
        return {
            ...this.createBaseMetadata(opportunity, integration, 'opportunity'),
            opportunityId: opportunity.Id,
            accountId: opportunity.AccountId,
            ownerId: opportunity.OwnerId,
            campaignId: opportunity.CampaignId,
            amount: opportunity.Amount?.toString(),
            probability: opportunity.Probability?.toString(),
            stageName: opportunity.StageName,
            isClosed: opportunity.IsClosed,
            isWon: opportunity.IsWon,
            fiscalYear: opportunity.FiscalYear?.toString(),
            fiscalQuarter: opportunity.FiscalQuarter?.toString(),
            lastActivityDate: opportunity.LastActivityDate,
            lastStageChangeDate: opportunity.LastStageChangeDate
        };
    }
}

const processOpportunities = async (client, integration, langchainPinecone, logger) => {
    return await BaseEntityProcessor.processEntities(
        'opportunities',
        client.getAllOpportunities.bind(client),
        (opportunities, integration) => opportunities.map(opportunity => 
            SalesforceDocumentCreator.createDocument(
                opportunity,
                'opportunity',
                SalesforceMetadataCreator.createOpportunityMetadata(opportunity, integration)
            )
        ),
        client,
        integration,
        langchainPinecone,
        logger
    );
};

const entityTypes = [
    { 
        name: 'opportunities',
        process: processOpportunities
    },
    // ... other entity types ...
];

module.exports = {
    entityTypes,
    processOpportunities,
    SalesforceMetadataCreator
}; 