const axios = require('axios');

class AgentboxClient {
    constructor(connectionSettings) {
        if (!connectionSettings?.clientId || !connectionSettings?.apiKey) {
            throw new Error('Client ID and API key are required in connection settings');
        }

        this.client = axios.create({
            baseURL: 'https://api.agentboxcrm.com.au',
            headers: {
                'Accept': 'application/json',
                'X-Client-ID': connectionSettings.clientId,
                'X-API-Key': connectionSettings.apiKey
            }
        });
    }

    async getAllContacts() {
        let contacts = [];
        let currentPage = 1;
        let lastPage = 1;
        const limit = 20;

        do {
            console.log(`Fetching contacts page ${currentPage}...`);
            
            try {
                const response = await this.client.get('/contacts', {
                    params: {
                        page: currentPage,
                        limit,
                        'filter[matchAllContactClass]': false,
                        'filter[reqIncSurroundSuburbs]': false,
                        'filter[limitSearch]': true,
                        version: 2
                    }
                });

                if (!response.data.response) {
                    throw new Error('Invalid response format from Agentbox API');
                }

                const pageContacts = response.data.response.contacts || [];
                console.log(`Found ${pageContacts.length} contacts on page ${currentPage}`);

                contacts = contacts.concat(pageContacts);
                lastPage = parseInt(response.data.response.last);
                currentPage++;

            } catch (error) {
                console.error('Error fetching contacts:', error.response?.data || error.message);
                throw error;
            }
        } while (currentPage <= lastPage);

        console.log(`Total contacts found: ${contacts.length}`);
        return contacts;
    }

    // Add more methods for other Agentbox endpoints as needed
}

module.exports = AgentboxClient; 