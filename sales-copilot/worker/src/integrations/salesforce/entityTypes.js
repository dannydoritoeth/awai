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

    static createAccountMetadata(account, integration) {
        return {
            ...this.createBaseMetadata(account, integration, 'account'),
            accountId: account.Id,
            parentId: account.ParentId,
            ownerId: account.OwnerId,
            type: account.Type,
            industry: account.Industry,
            rating: account.Rating,
            numberOfEmployees: account.NumberOfEmployees?.toString(),
            annualRevenue: account.AnnualRevenue?.toString(),
            customerPriority: account.CustomerPriority__c,
            sla: account.SLA__c,
            isActive: account.Active__c,
            lastActivityDate: account.LastActivityDate
        };
    }

    static createContactMetadata(contact, integration) {
        return {
            ...this.createBaseMetadata(contact, integration, 'contact'),
            contactId: contact.Id,
            accountId: contact.AccountId,
            ownerId: contact.OwnerId,
            firstName: contact.FirstName,
            lastName: contact.LastName,
            title: contact.Title,
            department: contact.Department,
            leadSource: contact.LeadSource,
            level: contact.Level__c,
            languages: contact.Languages__c,
            hasOptedOutOfEmail: contact.HasOptedOutOfEmail,
            doNotCall: contact.DoNotCall,
            lastActivityDate: contact.LastActivityDate
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

const processAccounts = async (client, integration, langchainPinecone, logger) => {
    return await BaseEntityProcessor.processEntities(
        'accounts',
        client.getAllAccounts.bind(client),
        (accounts, integration) => accounts.map(account => 
            SalesforceDocumentCreator.createDocument(
                account,
                'account',
                SalesforceMetadataCreator.createAccountMetadata(account, integration)
            )
        ),
        client,
        integration,
        langchainPinecone,
        logger
    );
};

const processContacts = async (client, integration, langchainPinecone, logger) => {
    return await BaseEntityProcessor.processEntities(
        'contacts',
        client.getAllContacts.bind(client),
        (contacts, integration) => contacts.map(contact => 
            SalesforceDocumentCreator.createDocument(
                contact,
                'contact',
                SalesforceMetadataCreator.createContactMetadata(contact, integration)
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
        name: 'accounts',
        process: processAccounts
    },
    {
        name: 'contacts',
        process: processContacts
    },
    { 
        name: 'opportunities',
        process: processOpportunities
    }
];

module.exports = {
    entityTypes,
    processAccounts,
    processContacts,
    processOpportunities,
    SalesforceMetadataCreator
}; 