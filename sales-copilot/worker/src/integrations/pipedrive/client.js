const axios = require('axios');

class PipedriveClient {
    constructor(connectionSettings) {
        if (!connectionSettings?.api_token) {
            throw new Error('API token is required in connection settings');
        }

        this.v1Client = axios.create({
            baseURL: 'https://api.pipedrive.com/v1',
            params: {
                api_token: connectionSettings.api_token
            }
        });

        this.v2Client = axios.create({
            baseURL: 'https://api.pipedrive.com/v2',
            params: {
                api_token: connectionSettings.api_token
            }
        });
    }

    async getAllDeals(startDate = null) {
        let deals = [];
        let more_items = true;
        let cursor = null;
        let page = 1;

        while (more_items) {
            const params = {
                limit: 100,
                ...(startDate && { filter_by_date: true, start_date: startDate }),
                ...(cursor && { cursor })
            };

            console.log(`Fetching deals page ${page}...`);
            const response = await this.v2Client.get('/deals', { params });
            const pageDeals = response.data.data || [];
            console.log(`Found ${pageDeals.length} deals on page ${page}`);

            deals = deals.concat(pageDeals);
            more_items = response.data.additional_data?.pagination?.more_items_in_collection || false;
            cursor = response.data.additional_data?.pagination?.next_cursor;
            page++;
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