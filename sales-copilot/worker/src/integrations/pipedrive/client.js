const axios = require('axios');
const rateLimiter = require('../../services/rateLimiterService');
const config = require('../../config/config');

class PipedriveClient {
    constructor(settings, testMode = false, testLimit = 3) {
        if (!settings || !settings.company_domain) {
            throw new Error('Invalid Pipedrive settings');
        }

        this.companyDomain = settings.company_domain;
        this.baseUrl = `https://${this.companyDomain}.pipedrive.com/api/v1`;
        this.apiToken = settings.api_token || settings.access_token;
        this.testMode = testMode;
        this.testLimit = testLimit;

        if (!this.apiToken) {
            throw new Error('No API token found in settings');
        }
    }

    async getAllDeals() {
        try {
            console.log('Fetching deals from Pipedrive...');
            // In test mode, limit the number of records
            const limit = this.testMode ? this.testLimit : 100;
            const deals = await this._get('/deals', { limit });
            console.log(`Found ${deals.length} deals`);
            return deals;
        } catch (error) {
            console.error('Error fetching deals:', error);
            throw error;
        }
    }

    async getAllLeads() {
        try {
            const limit = this.testMode ? this.testLimit : 100;
            const leads = await this._get('/leads', { limit });
            return leads;
        } catch (error) {
            console.error('Error fetching leads:', error);
            throw error;
        }
    }

    async getAllActivities() {
        try {
            const limit = this.testMode ? this.testLimit : 100;
            const activities = await this._get('/activities', { limit });
            return activities;
        } catch (error) {
            console.error('Error fetching activities:', error);
            throw error;
        }
    }

    async getAllPeople() {
        try {
            const limit = this.testMode ? this.testLimit : 100;
            const people = await this._get('/persons', { limit });
            return people;
        } catch (error) {
            console.error('Error fetching people:', error);
            throw error;
        }
    }

    async getAllNotes() {
        try {
            const limit = this.testMode ? this.testLimit : 100;
            const notes = await this._get('/notes', { limit });
            return notes;
        } catch (error) {
            console.error('Error fetching notes:', error);
            throw error;
        }
    }

    async getAllOrganizations() {
        try {
            const limit = this.testMode ? this.testLimit : 100;
            const organizations = await this._get('/organizations', { limit });
            return organizations;
        } catch (error) {
            console.error('Error fetching organizations:', error);
            throw error;
        }
    }

    async _get(endpoint, params = {}) {
        try {
            await rateLimiter.waitForToken();
            
            console.log(`Making request to: ${this.baseUrl}${endpoint}`);
            console.log('With params:', { ...params, api_token: '[REDACTED]' });

            const response = await axios.get(`${this.baseUrl}${endpoint}`, {
                params: {
                    ...params,
                    api_token: this.apiToken
                }
            });

            if (response.data && response.data.success && Array.isArray(response.data.data)) {
                return response.data.data;
            }

            console.error('Invalid response from Pipedrive:', response.data);
            throw new Error('Invalid response from Pipedrive');
        } catch (error) {
            if (error.response) {
                console.error('Pipedrive API error:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                });
            }
            throw error;
        }
    }
}

module.exports = PipedriveClient; 