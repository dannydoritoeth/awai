const BaseDocumentCreator = require('../baseDocumentCreator');

class SalesforceDocumentCreator extends BaseDocumentCreator {
    static getSource() {
        return 'salesforce';
    }

    static createText(entity, type) {
        switch (type) {
            case 'opportunity':
                return this.createOpportunityText(entity);
            // ... other entity types ...
            default:
                throw new Error(`Unknown entity type: ${type}`);
        }
    }

    static createOpportunityText(opportunity) {
        const parts = [
            `Name: ${opportunity.Name}`,
            opportunity.Amount ? `Amount: ${opportunity.Amount}` : null,
            `Stage: ${opportunity.StageName}`,
            `Close Date: ${opportunity.CloseDate}`,
            opportunity.Type ? `Type: ${opportunity.Type}` : null,
            opportunity.LeadSource ? `Lead Source: ${opportunity.LeadSource}` : null,
            `Probability: ${opportunity.Probability}%`,
            opportunity.Description ? `Description: ${opportunity.Description}` : null,
            opportunity.NextStep ? `Next Step: ${opportunity.NextStep}` : null,
            opportunity.ForecastCategory ? `Forecast Category: ${opportunity.ForecastCategory}` : null,
            `Status: ${opportunity.IsClosed ? (opportunity.IsWon ? 'Closed Won' : 'Closed Lost') : 'Open'}`,
            opportunity.ExpectedRevenue ? `Expected Revenue: ${opportunity.ExpectedRevenue}` : null,
            opportunity.HasOpenActivity ? 'Has Open Activities' : null,
            opportunity.HasOverdueTask ? 'Has Overdue Tasks' : null,
            opportunity.LastActivityDate ? `Last Activity: ${opportunity.LastActivityDate}` : null,
            opportunity.LastStageChangeDate ? `Last Stage Change: ${opportunity.LastStageChangeDate}` : null,
            opportunity.FiscalYear ? `Fiscal Year: ${opportunity.FiscalYear}` : null,
            opportunity.FiscalQuarter ? `Fiscal Quarter: ${opportunity.FiscalQuarter}` : null
        ];

        return parts.filter(Boolean).join('\n');
    }
}

module.exports = SalesforceDocumentCreator; 