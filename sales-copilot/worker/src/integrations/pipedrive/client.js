const axios = require('axios');
const rateLimiter = require('../../services/rateLimiterService');
const config = require('../../config/config');

class PipedriveClient {
    constructor(connectionSettings) {
        if (!connectionSettings?.api_token) {
            throw new Error('API token is required in connection settings');
        }

        this.companyId = connectionSettings.company_id;
        
        this.v1Client = axios.create({
            baseURL: 'https://api.pipedrive.com/v1',
            headers: {
                'Accept': 'application/json'
            },
            params: {
                api_token: connectionSettings.api_token
            }
        });

        this.testMode = config.worker.testMode;
        this.testRecordLimit = config.worker.testRecordLimit;
    }

    async makeRequest(endpoint, params = {}) {
        try {
            // Check rate limit before making request
            await rateLimiter.checkRateLimit(this.companyId);

            // Add test mode limit if enabled
            if (this.testMode) {
                params.limit = Math.min(params.limit || 100, this.testRecordLimit);
            }

            const response = await this.v1Client.get(endpoint, { params });

            if (response.data.success === false) {
                throw new Error(`Pipedrive API error: ${response.data.error || 'Unknown error'}`);
            }

            return response;
        } catch (error) {
            if (error.response?.status === 429) {
                // If we hit the rate limit, wait 1 second and try again
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.makeRequest(endpoint, params);
            }
            throw error;
        }
    }

    async getAllDeals(startDate = null) {
        let deals = [];
        let more_items = true;
        let start = 0;
        let page = 1;

        while (more_items) {
            const params = {
                limit: this.testMode ? this.testRecordLimit : 100,
                start,
                ...(startDate && { filter_by_date: true, start_date: startDate })
            };

            console.log(`Fetching deals page ${page}...`);
            
            try {
                const response = await this.makeRequest('/deals', params);
                const pageDeals = response.data.data || [];
                console.log(`Found ${pageDeals.length} deals on page ${page}`);

                deals = deals.concat(pageDeals);

                // In test mode, break after first page
                if (this.testMode) {
                    break;
                }

                more_items = response.data.additional_data?.pagination?.more_items_in_collection || false;
                start += 100;
                page++;
            } catch (error) {
                console.error('Error fetching deals:', error.response?.data || error.message);
                throw error;
            }
        }

        // In test mode, limit the total records
        if (this.testMode) {
            deals = deals.slice(0, this.testRecordLimit);
            console.log(`Test mode: Limited to ${deals.length} deals`);
        }

        return deals;
    }

    async getDealById(dealId) {
        const response = await this.v2Client.get(`/deals/${dealId}`);
        return response.data.data;
    }

    async getDealActivities(dealId) {
        const response = await this.v1Client.get(`/deals/${dealId}/activities`);
        return response.data.data;
    }

    async getDealNotes(dealId) {
        const response = await this.v1Client.get(`/deals/${dealId}/notes`);
        return response.data.data;
    }

    async getDealFields() {
        const response = await this.v2Client.get('/dealFields');
        return response.data.data;
    }

    async getAllLeads(startDate = null) {
        let leads = [];
        let more_items = true;
        let start = 0;
        let page = 1;

        while (more_items) {
            const params = {
                limit: this.testMode ? this.testRecordLimit : 100,
                start,
                ...(startDate && { filter_by_date: true, start_date: startDate })
            };

            console.log(`Fetching leads page ${page}...`);
            
            try {
                const response = await this.makeRequest('/leads', params);
                const pageLeads = response.data.data || [];
                console.log(`Found ${pageLeads.length} leads on page ${page}`);

                leads = leads.concat(pageLeads);

                // In test mode, break after first page
                if (this.testMode) {
                    break;
                }

                more_items = response.data.additional_data?.pagination?.more_items_in_collection || false;
                start += 100;
                page++;
            } catch (error) {
                console.error('Error fetching leads:', error.response?.data || error.message);
                throw error;
            }
        }

        // In test mode, limit the total records
        if (this.testMode) {
            leads = leads.slice(0, this.testRecordLimit);
            console.log(`Test mode: Limited to ${leads.length} leads`);
        }

        return leads;
    }

    async getAllActivities(startDate = null) {
        let activities = [];
        let more_items = true;
        let start = 0;
        let page = 1;

        while (more_items) {
            const params = {
                limit: this.testMode ? this.testRecordLimit : 100,
                start,
                ...(startDate && { filter_by_date: true, start_date: startDate })
            };

            console.log(`Fetching activities page ${page}...`);
            
            try {
                const response = await this.makeRequest('/activities', params);
                const pageActivities = response.data.data || [];
                console.log(`Found ${pageActivities.length} activities on page ${page}`);

                activities = activities.concat(pageActivities);

                // In test mode, break after first page
                if (this.testMode) {
                    break;
                }

                more_items = response.data.additional_data?.pagination?.more_items_in_collection || false;
                start += 100;
                page++;
            } catch (error) {
                console.error('Error fetching activities:', error.response?.data || error.message);
                throw error;
            }
        }

        // In test mode, limit the total records
        if (this.testMode) {
            activities = activities.slice(0, this.testRecordLimit);
            console.log(`Test mode: Limited to ${activities.length} activities`);
        }

        return activities;
    }

    async getAllPeople(startDate = null) {
        let people = [];
        let more_items = true;
        let start = 0;
        let page = 1;

        while (more_items) {
            const params = {
                limit: this.testMode ? this.testRecordLimit : 100,
                start,
                ...(startDate && { filter_by_date: true, start_date: startDate })
            };

            console.log(`Fetching people page ${page}...`);
            
            try {
                const response = await this.makeRequest('/persons', params);
                const pagePeople = response.data.data || [];
                console.log(`Found ${pagePeople.length} people on page ${page}`);

                people = people.concat(pagePeople);

                // In test mode, break after first page
                if (this.testMode) {
                    break;
                }

                more_items = response.data.additional_data?.pagination?.more_items_in_collection || false;
                start += 100;
                page++;
            } catch (error) {
                console.error('Error fetching people:', error.response?.data || error.message);
                throw error;
            }
        }

        // In test mode, limit the total records
        if (this.testMode) {
            people = people.slice(0, this.testRecordLimit);
            console.log(`Test mode: Limited to ${people.length} people`);
        }

        return people;
    }

    async getAllNotes(startDate = null) {
        let notes = [];
        let more_items = true;
        let start = 0;
        let page = 1;

        while (more_items) {
            const params = {
                limit: this.testMode ? this.testRecordLimit : 100,
                start,
                ...(startDate && { filter_by_date: true, start_date: startDate })
            };

            console.log(`Fetching notes page ${page}...`);
            
            try {
                const response = await this.makeRequest('/notes', params);
                const pageNotes = response.data.data || [];
                console.log(`Found ${pageNotes.length} notes on page ${page}`);

                notes = notes.concat(pageNotes);

                // In test mode, break after first page
                if (this.testMode) {
                    break;
                }

                more_items = response.data.additional_data?.pagination?.more_items_in_collection || false;
                start += 100;
                page++;
            } catch (error) {
                console.error('Error fetching notes:', error.response?.data || error.message);
                throw error;
            }
        }

        // In test mode, limit the total records
        if (this.testMode) {
            notes = notes.slice(0, this.testRecordLimit);
            console.log(`Test mode: Limited to ${notes.length} notes`);
        }

        return notes;
    }

    async getAllOrganizations(startDate = null) {
        let organizations = [];
        let more_items = true;
        let start = 0;
        let page = 1;

        while (more_items) {
            const params = {
                limit: this.testMode ? this.testRecordLimit : 100,
                start,
                ...(startDate && { filter_by_date: true, start_date: startDate })
            };

            console.log(`Fetching organizations page ${page}...`);
            
            try {
                const response = await this.makeRequest('/organizations', params);
                const pageOrganizations = response.data.data || [];
                console.log(`Found ${pageOrganizations.length} organizations on page ${page}`);

                organizations = organizations.concat(pageOrganizations);

                // In test mode, break after first page
                if (this.testMode) {
                    break;
                }

                more_items = response.data.additional_data?.pagination?.more_items_in_collection || false;
                start += 100;
                page++;
            } catch (error) {
                console.error('Error fetching organizations:', error.response?.data || error.message);
                throw error;
            }
        }

        // In test mode, limit the total records
        if (this.testMode) {
            organizations = organizations.slice(0, this.testRecordLimit);
            console.log(`Test mode: Limited to ${organizations.length} organizations`);
        }

        return organizations;
    }
}

module.exports = PipedriveClient; 