const BaseDocumentCreator = require('../baseDocumentCreator');

class SalesforceDocumentCreator extends BaseDocumentCreator {
    static getSource() {
        return 'salesforce';
    }

    static createText(entity, type) {
        switch (type) {
            case 'account':
                return this.createAccountText(entity);
            case 'contact':
                return this.createContactText(entity);
            case 'opportunity':
                return this.createOpportunityText(entity);
            case 'activity':
                return this.createActivityText(entity);
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

    static createAccountText(account) {
        const parts = [
            `Name: ${account.Name}`,
            account.Type ? `Type: ${account.Type}` : null,
            account.Industry ? `Industry: ${account.Industry}` : null,
            account.Description ? `Description: ${account.Description}` : null,
            this.formatAddress({
                street: account.BillingStreet,
                city: account.BillingCity,
                state: account.BillingState,
                postalCode: account.BillingPostalCode,
                country: account.BillingCountry
            }) ? `Billing Address: ${this.formatAddress({
                street: account.BillingStreet,
                city: account.BillingCity,
                state: account.BillingState,
                postalCode: account.BillingPostalCode,
                country: account.BillingCountry
            })}` : null,
            account.Phone ? `Phone: ${account.Phone}` : null,
            account.Website ? `Website: ${account.Website}` : null,
            account.NumberOfEmployees ? `Employees: ${account.NumberOfEmployees}` : null,
            account.AnnualRevenue ? `Annual Revenue: ${account.AnnualRevenue}` : null,
            account.Rating ? `Rating: ${account.Rating}` : null,
            account.CustomerPriority__c ? `Customer Priority: ${account.CustomerPriority__c}` : null,
            account.SLA__c ? `SLA: ${account.SLA__c}` : null,
            account.Active__c ? `Active: ${account.Active__c}` : null,
            account.LastActivityDate ? `Last Activity: ${account.LastActivityDate}` : null
        ];

        return parts.filter(Boolean).join('\n');
    }

    static createContactText(contact) {
        const parts = [
            `Name: ${this.formatName(contact.FirstName, contact.LastName)}`,
            contact.Title ? `Title: ${contact.Title}` : null,
            contact.Department ? `Department: ${contact.Department}` : null,
            contact.Email ? `Email: ${contact.Email}` : null,
            contact.Phone ? `Phone: ${contact.Phone}` : null,
            contact.MobilePhone ? `Mobile: ${contact.MobilePhone}` : null,
            contact.Description ? `Description: ${contact.Description}` : null,
            this.formatAddress({
                street: contact.MailingStreet,
                city: contact.MailingCity,
                state: contact.MailingState,
                postalCode: contact.MailingPostalCode,
                country: contact.MailingCountry
            }) ? `Mailing Address: ${this.formatAddress({
                street: contact.MailingStreet,
                city: contact.MailingCity,
                state: contact.MailingState,
                postalCode: contact.MailingPostalCode,
                country: contact.MailingCountry
            })}` : null,
            contact.Birthdate ? `Birthdate: ${contact.Birthdate}` : null,
            contact.LeadSource ? `Lead Source: ${contact.LeadSource}` : null,
            contact.Level__c ? `Level: ${contact.Level__c}` : null,
            contact.Languages__c ? `Languages: ${contact.Languages__c}` : null,
            contact.HasOptedOutOfEmail ? 'Has Opted Out of Email' : null,
            contact.DoNotCall ? 'Do Not Call' : null,
            contact.LastActivityDate ? `Last Activity: ${contact.LastActivityDate}` : null
        ];

        return parts.filter(Boolean).join('\n');
    }

    static createActivityText(activity) {
        if (activity.activityType === 'Task') {
            return this.createTaskText(activity);
        } else if (activity.activityType === 'Event') {
            return this.createEventText(activity);
        }
        throw new Error(`Unknown activity type: ${activity.activityType}`);
    }

    static createTaskText(task) {
        const parts = [
            `Type: Task`,
            `Subject: ${task.Subject}`,
            task.Description ? `Description: ${task.Description}` : null,
            `Status: ${task.Status}`,
            `Priority: ${task.Priority}`,
            task.ActivityDate ? `Due Date: ${task.ActivityDate}` : null,
            task.IsHighPriority ? 'High Priority' : null,
            `Closed: ${task.IsClosed ? 'Yes' : 'No'}`,
            task.CallType ? `Call Type: ${task.CallType}` : null,
            task.CallDurationInSeconds ? `Call Duration: ${Math.floor(task.CallDurationInSeconds / 60)} minutes` : null,
            task.CallDisposition ? `Call Disposition: ${task.CallDisposition}` : null,
            task.ReminderDateTime ? `Reminder: ${task.ReminderDateTime}` : null,
            task.RecurrenceType ? `Recurrence: ${task.RecurrenceType}` : null,
            task.RecurrenceInterval ? `Recurrence Interval: ${task.RecurrenceInterval}` : null,
            task.RecurrenceEndDateOnly ? `Recurrence End: ${task.RecurrenceEndDateOnly}` : null
        ];

        return parts.filter(Boolean).join('\n');
    }

    static createEventText(event) {
        const parts = [
            `Type: Event`,
            `Subject: ${event.Subject}`,
            event.Description ? `Description: ${event.Description}` : null,
            event.Location ? `Location: ${event.Location}` : null,
            event.StartDateTime ? `Start: ${event.StartDateTime}` : null,
            event.EndDateTime ? `End: ${event.EndDateTime}` : null,
            event.IsAllDayEvent ? 'All Day Event' : null,
            event.ShowAs ? `Show As: ${event.ShowAs}` : null,
            event.Duration ? `Duration: ${event.Duration} minutes` : null,
            event.IsGroupEvent ? `Group Event: ${event.GroupEventType}` : null,
            event.IsRecurrence ? 'Recurring Event' : null,
            event.RecurrenceType ? `Recurrence: ${event.RecurrenceType}` : null,
            event.RecurrenceInterval ? `Recurrence Interval: ${event.RecurrenceInterval}` : null,
            event.RecurrenceEndDateOnly ? `Recurrence End: ${event.RecurrenceEndDateOnly}` : null
        ];

        return parts.filter(Boolean).join('\n');
    }
}

module.exports = SalesforceDocumentCreator; 