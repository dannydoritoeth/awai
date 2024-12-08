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
}

module.exports = SalesforceClient; 