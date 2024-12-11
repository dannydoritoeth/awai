const axios = require('axios');
const rateLimiter = require('../../services/rateLimiterService');

class SalesforceClient {
    constructor(settings, testMode = false, testLimit = 3) {
        if (!settings || !settings.instance_url || !settings.access_token) {
            throw new Error('Invalid Salesforce settings');
        }

        this.instanceUrl = settings.instance_url;
        this.accessToken = settings.access_token;
        this.testMode = testMode;
        this.testLimit = testLimit;
    }

    async _get(endpoint, params = {}) {
        try {
            await rateLimiter.waitForToken();
            
            console.log(`Making request to: ${this.instanceUrl}${endpoint}`);
            console.log('With params:', params);

            const response = await axios.get(`${this.instanceUrl}/services/data/v59.0${endpoint}`, {
                params,
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            if (error.response) {
                console.error('Salesforce API error:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                });
            }
            throw error;
        }
    }

    async getAllAccounts() {
        try {
            const limit = this.testMode ? this.testLimit : 200;
            const accounts = await this._get('/query', {
                q: `SELECT 
                    Id,
                    Name,
                    Type,
                    Industry,
                    Description,
                    BillingStreet,
                    BillingCity,
                    BillingState,
                    BillingPostalCode,
                    BillingCountry,
                    ShippingStreet,
                    ShippingCity,
                    ShippingState,
                    ShippingPostalCode,
                    ShippingCountry,
                    Phone,
                    Website,
                    NumberOfEmployees,
                    AnnualRevenue,
                    Rating,
                    CustomerPriority__c,
                    SLA__c,
                    Active__c,
                    ParentId,
                    OwnerId,
                    LastActivityDate,
                    CreatedDate,
                    LastModifiedDate
                    FROM Account 
                    ORDER BY CreatedDate DESC 
                    LIMIT ${limit}`
            });
            
            console.log(`Retrieved ${accounts.records.length} accounts from Salesforce`);
            return accounts.records;
        } catch (error) {
            console.error('Error fetching accounts:', error);
            throw error;
        }
    }

    async getAllOpportunities() {
        try {
            const limit = this.testMode ? this.testLimit : 200;
            const opportunities = await this._get('/query', {
                q: `SELECT 
                    Id,
                    Name,
                    AccountId,
                    Amount,
                    CloseDate,
                    Description,
                    ExpectedRevenue,
                    ForecastCategory,
                    HasOpenActivity,
                    HasOverdueTask,
                    IsClosed,
                    IsWon,
                    LeadSource,
                    NextStep,
                    Probability,
                    StageName,
                    Type,
                    OwnerId,
                    CampaignId,
                    LastActivityDate,
                    LastStageChangeDate,
                    FiscalYear,
                    FiscalQuarter,
                    CreatedDate,
                    LastModifiedDate
                    FROM Opportunity 
                    ORDER BY CreatedDate DESC 
                    LIMIT ${limit}`
            });
            
            console.log(`Retrieved ${opportunities.records.length} opportunities from Salesforce`);
            return opportunities.records;
        } catch (error) {
            console.error('Error fetching opportunities:', error);
            throw error;
        }
    }

    async getAllContacts() {
        try {
            const limit = this.testMode ? this.testLimit : 200;
            const contacts = await this._get('/query', {
                q: `SELECT 
                    Id,
                    AccountId,
                    FirstName,
                    LastName,
                    Title,
                    Department,
                    Email,
                    Phone,
                    MobilePhone,
                    Description,
                    MailingStreet,
                    MailingCity,
                    MailingState,
                    MailingPostalCode,
                    MailingCountry,
                    OtherStreet,
                    OtherCity,
                    OtherState,
                    OtherPostalCode,
                    OtherCountry,
                    Birthdate,
                    LeadSource,
                    Level__c,
                    Languages__c,
                    OwnerId,
                    HasOptedOutOfEmail,
                    DoNotCall,
                    LastActivityDate,
                    CreatedDate,
                    LastModifiedDate
                    FROM Contact 
                    ORDER BY CreatedDate DESC 
                    LIMIT ${limit}`
            });
            
            console.log(`Retrieved ${contacts.records.length} contacts from Salesforce`);
            return contacts.records;
        } catch (error) {
            console.error('Error fetching contacts:', error);
            throw error;
        }
    }

    async getAllLeads() {
        try {
            const limit = this.testMode ? this.testLimit : 200;
            const leads = await this._get('/query', {
                q: `SELECT 
                    Id, 
                    FirstName, 
                    LastName, 
                    Company,
                    Title,
                    Email, 
                    Phone, 
                    MobilePhone,
                    Industry,
                    NumberOfEmployees,
                    Rating,
                    Status,
                    Street,
                    City,
                    State,
                    PostalCode,
                    Country,
                    Description,
                    Website,
                    AnnualRevenue,
                    LeadSource,
                    ConvertedAccountId,
                    ConvertedContactId,
                    ConvertedOpportunityId,
                    ConvertedDate,
                    IsConverted,
                    LastActivityDate,
                    CreatedDate,
                    LastModifiedDate
                    FROM Lead 
                    ORDER BY CreatedDate DESC 
                    LIMIT ${limit}`
            });
            
            console.log(`Retrieved ${leads.records.length} leads from Salesforce`);
            return leads.records;
        } catch (error) {
            console.error('Error fetching leads:', error);
            throw error;
        }
    }

    // Add a method to fetch leads by date range if needed
    async getLeadsByDateRange(startDate, endDate) {
        try {
            const leads = await this._get('/query', {
                q: `SELECT 
                    Id, 
                    FirstName, 
                    LastName, 
                    Company,
                    Title,
                    Email, 
                    Phone,
                    Industry,
                    Status,
                    Description,
                    CreatedDate,
                    LastModifiedDate
                    FROM Lead 
                    WHERE CreatedDate >= ${startDate} 
                    AND CreatedDate <= ${endDate}
                    ORDER BY CreatedDate DESC`
            });
            
            console.log(`Retrieved ${leads.records.length} leads for date range`);
            return leads.records;
        } catch (error) {
            console.error('Error fetching leads by date range:', error);
            throw error;
        }
    }

    async getAllActivities() {
        try {
            const [tasks, events] = await Promise.all([
                this.getAllTasks(),
                this.getAllEvents()
            ]);
            
            console.log(`Retrieved ${tasks.length + events.length} total activities from Salesforce`);
            return [...tasks, ...events];
        } catch (error) {
            console.error('Error fetching activities:', error);
            throw error;
        }
    }

    async getAllTasks() {
        try {
            const limit = this.testMode ? this.testLimit : 200;
            const tasks = await this._get('/query', {
                q: `SELECT 
                    Id,
                    Subject,
                    Description,
                    Status,
                    Priority,
                    ActivityDate,
                    WhoId,
                    WhatId,
                    OwnerId,
                    Type,
                    IsHighPriority,
                    IsClosed,
                    CallDurationInSeconds,
                    CallType,
                    CallDisposition,
                    CallObject,
                    ReminderDateTime,
                    IsReminderSet,
                    AccountId,
                    RecurrenceType,
                    RecurrenceInterval,
                    RecurrenceEndDateOnly,
                    CreatedDate,
                    LastModifiedDate
                    FROM Task 
                    ORDER BY CreatedDate DESC 
                    LIMIT ${limit}`
            });
            
            console.log(`Retrieved ${tasks.records.length} tasks from Salesforce`);
            return tasks.records.map(task => ({ ...task, activityType: 'Task' }));
        } catch (error) {
            console.error('Error fetching tasks:', error);
            throw error;
        }
    }

    async getAllEvents() {
        try {
            const limit = this.testMode ? this.testLimit : 200;
            const events = await this._get('/query', {
                q: `SELECT 
                    Id,
                    Subject,
                    Description,
                    Location,
                    StartDateTime,
                    EndDateTime,
                    ActivityDate,
                    WhoId,
                    WhatId,
                    OwnerId,
                    Type,
                    IsAllDayEvent,
                    IsPrivate,
                    ShowAs,
                    Duration,
                    IsGroupEvent,
                    GroupEventType,
                    AccountId,
                    RecurrenceType,
                    RecurrenceInterval,
                    RecurrenceEndDateOnly,
                    IsRecurrence,
                    CreatedDate,
                    LastModifiedDate
                    FROM Event 
                    ORDER BY CreatedDate DESC 
                    LIMIT ${limit}`
            });
            
            console.log(`Retrieved ${events.records.length} events from Salesforce`);
            return events.records.map(event => ({ ...event, activityType: 'Event' }));
        } catch (error) {
            console.error('Error fetching events:', error);
            throw error;
        }
    }

    async getLeadConversionHistory() {
        try {
            const limit = this.testMode ? this.testLimit : 200;
            const conversions = await this._get('/query', {
                q: `SELECT 
                    Id,
                    LeadId,
                    ConvertedDate,
                    ConvertedAccountId,
                    ConvertedContactId,
                    ConvertedOpportunityId,
                    CreatedById,
                    IsDeleted,
                    CreatedDate,
                    SystemModstamp
                    FROM LeadHistory 
                    WHERE Field = 'converted'
                    ORDER BY CreatedDate DESC 
                    LIMIT ${limit}`
            });
            
            console.log(`Retrieved ${conversions.records.length} lead conversion records`);
            return conversions.records;
        } catch (error) {
            console.error('Error fetching lead conversion history:', error);
            throw error;
        }
    }

    async getLeadScoreHistory() {
        try {
            const limit = this.testMode ? this.testLimit : 200;
            const scores = await this._get('/query', {
                q: `SELECT 
                    Id,
                    LeadId,
                    Score,
                    Grade,
                    Reason,
                    ModelId,
                    CreatedDate
                    FROM LeadScoreHistory__c 
                    ORDER BY CreatedDate DESC 
                    LIMIT ${limit}`
            });
            
            return scores.records;
        } catch (error) {
            console.error('Error fetching lead scores:', error);
            throw error;
        }
    }

    async getOpportunityHistory() {
        try {
            const limit = this.testMode ? this.testLimit : 200;
            const history = await this._get('/query', {
                q: `SELECT 
                    Id,
                    OpportunityId,
                    Field,
                    OldValue,
                    NewValue,
                    CreatedDate,
                    CreatedById,
                    StageName,
                    Amount,
                    ExpectedRevenue,
                    Probability,
                    ForecastCategory
                    FROM OpportunityHistory 
                    ORDER BY CreatedDate DESC 
                    LIMIT ${limit}`
            });
            
            console.log(`Retrieved ${history.records.length} opportunity history records`);
            return history.records;
        } catch (error) {
            console.error('Error fetching opportunity history:', error);
            throw error;
        }
    }

    async getCampaignInfluence() {
        try {
            const limit = this.testMode ? this.testLimit : 200;
            const influence = await this._get('/query', {
                q: `SELECT 
                    Id,
                    CampaignId,
                    OpportunityId,
                    ContactId,
                    ModelId,
                    Influence,
                    Revenue,
                    FirstTouchDate,
                    LastTouchDate,
                    CreatedDate
                    FROM CampaignInfluence 
                    ORDER BY CreatedDate DESC 
                    LIMIT ${limit}`
            });
            
            console.log(`Retrieved ${influence.records.length} campaign influence records`);
            return influence.records;
        } catch (error) {
            console.error('Error fetching campaign influence:', error);
            throw error;
        }
    }
}

module.exports = SalesforceClient; 