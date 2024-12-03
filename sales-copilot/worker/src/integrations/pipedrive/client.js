const axios = require('axios');

class PipedriveClient {
    constructor(connectionSettings) {
        if (!connectionSettings?.api_token) {
            throw new Error('API token is required in connection settings');
        }

        this.v1Client = axios.create({
            baseURL: 'https://api.pipedrive.com/v1',
            headers: {
                'Accept': 'application/json'
            },
            params: {
                api_token: connectionSettings.api_token
            }
        });

        this.v2Client = axios.create({
            baseURL: 'https://api.pipedrive.com/v2',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${connectionSettings.api_token}`
            }
        });
    }

    async getAllDeals(startDate = null) {
        let deals = [];
        let more_items = true;
        let start = 0;
        let page = 1;

        while (more_items) {
            const params = {
                limit: 100,
                start,
                ...(startDate && { filter_by_date: true, start_date: startDate })
            };

            console.log(`Fetching deals page ${page}...`);
            
            try {
                const response = await this.v1Client.get('/deals', { params });
                console.log('Response status:', response.status);

                const pageDeals = response.data.data || [];
                console.log(`Found ${pageDeals.length} deals on page ${page}`);

                if (response.data.success === false) {
                    console.error('Pipedrive API error:', response.data);
                    throw new Error(`Pipedrive API error: ${response.data.error || 'Unknown error'}`);
                }

                deals = deals.concat(pageDeals);
                more_items = response.data.additional_data?.pagination?.more_items_in_collection || false;
                start += 100;
                page++;
            } catch (error) {
                console.error('Error fetching deals:', error.response?.data || error.message);
                throw error;
            }
        }

        console.log(`Total deals found: ${deals.length}`);
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
}

module.exports = PipedriveClient; 