const { Document } = require("@langchain/core/documents");

class SalesforceDocumentCreator {
    static createDocument(entity, type, metadata) {
        const pageContent = this.createText(entity, type);
        return new Document({
            pageContent,
            metadata: {
                ...metadata,
                type,
                source: 'salesforce'
            }
        });
    }

    static createText(entity, type) {
        switch (type) {
            case 'account':
                return this.createAccountText(entity);
            case 'opportunity':
                return this.createOpportunityText(entity);
            case 'contact':
                return this.createContactText(entity);
            case 'lead':
                return this.createLeadText(entity);
            default:
                throw new Error(`Unknown entity type: ${type}`);
        }
    }

    static createAccountText(account) {
        const parts = [
            `Name: ${account.Name}`,
            account.Type ? `Type: ${account.Type}` : null,
            account.Industry ? `Industry: ${account.Industry}` : null,
            account.Description ? `Description: ${account.Description}` : null,
            account.BillingAddress ? `Address: ${this.formatAddress(account.BillingAddress)}` : null,
            account.Phone ? `Phone: ${account.Phone}` : null,
            account.Website ? `Website: ${account.Website}` : null,
            account.AnnualRevenue ? `Annual Revenue: ${account.AnnualRevenue}` : null,
            account.NumberOfEmployees ? `Employees: ${account.NumberOfEmployees}` : null
        ];
        return parts.filter(Boolean).join('\n');
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
            opportunity.NextStep ? `Next Step: ${opportunity.NextStep}` : null
        ];
        return parts.filter(Boolean).join('\n');
    }

    static createContactText(contact) {
        const parts = [
            `Name: ${[contact.FirstName, contact.LastName].filter(Boolean).join(' ')}`,
            contact.Title ? `Title: ${contact.Title}` : null,
            contact.Department ? `Department: ${contact.Department}` : null,
            contact.Email ? `Email: ${contact.Email}` : null,
            contact.Phone ? `Phone: ${contact.Phone}` : null,
            contact.Description ? `Description: ${contact.Description}` : null,
            contact.MailingAddress ? `Address: ${this.formatAddress(contact.MailingAddress)}` : null
        ];
        return parts.filter(Boolean).join('\n');
    }

    static createLeadText(lead) {
        const parts = [
            `Name: ${[lead.FirstName, lead.LastName].filter(Boolean).join(' ')}`,
            `Company: ${lead.Company}`,
            lead.Title ? `Title: ${lead.Title}` : null,
            lead.Industry ? `Industry: ${lead.Industry}` : null,
            `Status: ${lead.Status}`,
            lead.Rating ? `Rating: ${lead.Rating}` : null,
            lead.Email ? `Email: ${lead.Email}` : null,
            lead.Phone ? `Phone: ${lead.Phone}` : null,
            lead.MobilePhone ? `Mobile: ${lead.MobilePhone}` : null,
            lead.Website ? `Website: ${lead.Website}` : null,
            lead.NumberOfEmployees ? `Number of Employees: ${lead.NumberOfEmployees}` : null,
            lead.AnnualRevenue ? `Annual Revenue: ${lead.AnnualRevenue}` : null,
            lead.LeadSource ? `Lead Source: ${lead.LeadSource}` : null,
            this.formatAddress({
                street: lead.Street,
                city: lead.City,
                state: lead.State,
                postalCode: lead.PostalCode,
                country: lead.Country
            }) ? `Address: ${this.formatAddress({
                street: lead.Street,
                city: lead.City,
                state: lead.State,
                postalCode: lead.PostalCode,
                country: lead.Country
            })}` : null,
            lead.Description ? `Description: ${lead.Description}` : null,
            lead.IsConverted ? `Converted: Yes` : null,
            lead.ConvertedDate ? `Converted Date: ${lead.ConvertedDate}` : null,
            lead.LastActivityDate ? `Last Activity: ${lead.LastActivityDate}` : null
        ];
        return parts.filter(Boolean).join('\n');
    }

    static formatAddress(address) {
        if (!address) return '';
        const parts = [
            address.street,
            address.city,
            address.state,
            address.postalCode,
            address.country
        ];
        return parts.filter(Boolean).join(', ');
    }
}

module.exports = SalesforceDocumentCreator; 