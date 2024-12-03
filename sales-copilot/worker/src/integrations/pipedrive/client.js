const axios = require('axios');

class PipedriveClient {
    constructor(apiKey) {
        this.v1Client = axios.create({
            baseURL: 'https://api.pipedrive.com/v1',
            params: {
                api_token: apiKey
            }
        });

        this.v2Client = axios.create({
            baseURL: 'https://api.pipedrive.com/v2',
            params: {
                api_token: apiKey
            }
        });
    }

    async getAllDeals(startDate = null) {
        let deals = [];
        let more_items = true;
        let cursor = null;

        while (more_items) {
            const params = {
                limit: 100,
                ...(startDate && { filter_by_date: true, start_date: startDate }),
                ...(cursor && { cursor })
            };

            const response = await this.v2Client.get('/deals', { params });

            deals = deals.concat(response.data.data || []);
            more_items = response.data.additional_data?.pagination?.more_items_in_collection || false;
            cursor = response.data.additional_data?.pagination?.next_cursor;
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
}

module.exports = PipedriveClient; 