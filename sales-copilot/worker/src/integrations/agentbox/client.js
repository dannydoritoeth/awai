const axios = require('axios');
const config = require('../../config/config');

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

        this.testMode = config.worker.testMode;
        this.testRecordLimit = config.worker.testRecordLimit;
    }

    async getAllContacts() {
        let contacts = [];
        let currentPage = 1;
        let lastPage = 1;
        const limit = this.testMode ? this.testRecordLimit : 20;

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

                // In test mode, break after first page
                if (this.testMode) {
                    break;
                }

                lastPage = parseInt(response.data.response.last);
                currentPage++;

            } catch (error) {
                console.error('Error fetching contacts:', error.response?.data || error.message);
                throw error;
            }
        } while (currentPage <= lastPage);

        // In test mode, limit the total records
        if (this.testMode) {
            contacts = contacts.slice(0, this.testRecordLimit);
            console.log(`Test mode: Limited to ${contacts.length} contacts`);
        }

        console.log(`Total contacts found: ${contacts.length}`);
        return contacts;
    }

    async getAllListings() {
        let listings = [];
        let currentPage = 1;
        let lastPage = 1;
        const limit = 20;

        do {
            console.log(`Fetching listings page ${currentPage}...`);
            
            try {
                const response = await this.client.get('/listings', {
                    params: {
                        page: currentPage,
                        limit,
                        'filter[incSurroundSuburbs]': false,
                        'filter[matchAllFeature]': false,
                        version: 2
                    }
                });

                if (!response.data.response) {
                    throw new Error('Invalid response format from Agentbox API');
                }

                const pageListings = response.data.response.listings || [];
                console.log(`Found ${pageListings.length} listings on page ${currentPage}`);

                listings = listings.concat(pageListings);
                lastPage = parseInt(response.data.response.last);
                currentPage++;

            } catch (error) {
                console.error('Error fetching listings:', error.response?.data || error.message);
                throw error;
            }
        } while (currentPage <= lastPage);

        console.log(`Total listings found: ${listings.length}`);
        return listings;
    }

    async getAllStaff() {
        let staffMembers = [];
        let currentPage = 1;
        let lastPage = 1;
        const limit = 20;

        do {
            console.log(`Fetching staff page ${currentPage}...`);
            
            try {
                const response = await this.client.get('/staff', {
                    params: {
                        page: currentPage,
                        limit,
                        version: 2
                    }
                });

                if (!response.data.response) {
                    throw new Error('Invalid response format from Agentbox API');
                }

                const pageStaff = response.data.response.staffMembers || [];
                console.log(`Found ${pageStaff.length} staff members on page ${currentPage}`);

                staffMembers = staffMembers.concat(pageStaff);
                lastPage = parseInt(response.data.response.last);
                currentPage++;

            } catch (error) {
                console.error('Error fetching staff:', error.response?.data || error.message);
                throw error;
            }
        } while (currentPage <= lastPage);

        console.log(`Total staff members found: ${staffMembers.length}`);
        return staffMembers;
    }

    async getEnquiries() {
        try {
            const limit = this.testMode ? this.testLimit : 100;
            const response = await this._get('/enquiries', {
                version: 2,
                limit,
                page: 1
            });

            if (!response || !response.response || !response.response.enquiries) {
                console.error('Invalid response format from Agentbox enquiries API');
                return [];
            }

            console.log(`Retrieved ${response.response.enquiries.length} enquiries`);
            return response.response.enquiries;
        } catch (error) {
            console.error('Error fetching enquiries:', error);
            throw error;
        }
    }

    async getProspectiveBuyers() {
        try {
            const limit = this.testMode ? this.testLimit : 100;
            const response = await this._get('/prospective-buyers', {
                version: 2,
                limit,
                page: 1
            });

            if (!response || !response.response || !response.response.prospectiveBuyers) {
                console.error('Invalid response format from Agentbox prospective buyers API');
                return [];
            }

            console.log(`Retrieved ${response.response.prospectiveBuyers.length} prospective buyers`);
            return response.response.prospectiveBuyers;
        } catch (error) {
            console.error('Error fetching prospective buyers:', error);
            throw error;
        }
    }

    async getListings() {
        try {
            const limit = this.testMode ? this.testLimit : 100;
            const response = await this._get('/listings', {
                version: 2,
                limit,
                page: 1,
                filter: {
                    incSurroundSuburbs: false,
                    matchAllFeature: false
                }
            });

            if (!response || !response.response || !response.response.listings) {
                console.error('Invalid response format from Agentbox listings API');
                return [];
            }

            console.log(`Retrieved ${response.response.listings.length} listings`);
            return response.response.listings;
        } catch (error) {
            console.error('Error fetching listings:', error);
            throw error;
        }
    }

    async getContacts() {
        try {
            const limit = this.testMode ? this.testLimit : 100;
            const response = await this._get('/contacts', {
                version: 2,
                limit,
                page: 1,
                filter: {
                    matchAllContactClass: false,
                    reqIncSurroundSuburbs: false,
                    limitSearch: true
                }
            });

            if (!response || !response.response || !response.response.contacts) {
                console.error('Invalid response format from Agentbox contacts API');
                return [];
            }

            console.log(`Retrieved ${response.response.contacts.length} contacts`);
            return response.response.contacts;
        } catch (error) {
            console.error('Error fetching contacts:', error);
            throw error;
        }
    }

    async getSearchRequirements() {
        try {
            const limit = this.testMode ? this.testLimit : 100;
            const response = await this._get('/search-requirements', {
                version: 2,
                limit,
                page: 1
            });

            if (!response || !response.response || !response.response.searchRequirements) {
                console.error('Invalid response format from Agentbox search requirements API');
                return [];
            }

            console.log(`Retrieved ${response.response.searchRequirements.length} search requirements`);
            return response.response.searchRequirements;
        } catch (error) {
            console.error('Error fetching search requirements:', error);
            throw error;
        }
    }

    async getEnquiryInterestLevels() {
        try {
            const response = await this.client.get('/enquiry-interest-levels', {
                params: {
                    version: 2,
                    limit: 20,
                    page: 1
                }
            });

            if (!response.data.response || !response.data.response.enquiryInterestLevels) {
                throw new Error('Invalid response format from Agentbox API');
            }

            console.log(`Retrieved ${response.data.response.enquiryInterestLevels.length} interest levels`);
            return response.data.response.enquiryInterestLevels;
        } catch (error) {
            console.error('Error fetching interest levels:', error.response?.data || error.message);
            throw error;
        }
    }

    async getPropertyTypes() {
        try {
            const response = await this.client.get('/property-types', {
                params: {
                    version: 2,
                    limit: 20,
                    page: 1
                }
            });

            if (!response.data.response || !response.data.response.propertyTypes) {
                throw new Error('Invalid response format from Agentbox API');
            }

            console.log(`Retrieved ${response.data.response.propertyTypes.length} property types`);
            return response.data.response.propertyTypes;
        } catch (error) {
            console.error('Error fetching property types:', error.response?.data || error.message);
            throw error;
        }
    }

    async getRegions() {
        try {
            const response = await this.client.get('/regions', {
                params: {
                    version: 2,
                    limit: 20,
                    page: 1
                }
            });

            if (!response.data.response || !response.data.response.regions) {
                throw new Error('Invalid response format from Agentbox API');
            }

            console.log(`Retrieved ${response.data.response.regions.length} regions`);
            return response.data.response.regions;
        } catch (error) {
            console.error('Error fetching regions:', error.response?.data || error.message);
            throw error;
        }
    }

    async getEnquirySources() {
        try {
            const response = await this.client.get('/enquiry-sources', {
                params: {
                    version: 2,
                    limit: 20,
                    page: 1
                }
            });

            if (!response.data.response || !response.data.response.enquirySources) {
                throw new Error('Invalid response format from Agentbox API');
            }

            console.log(`Retrieved ${response.data.response.enquirySources.length} enquiry sources`);
            return response.data.response.enquirySources;
        } catch (error) {
            console.error('Error fetching enquiry sources:', error.response?.data || error.message);
            throw error;
        }
    }

    async getContactClasses() {
        try {
            const response = await this.client.get('/contact-classes', {
                params: {
                    version: 2,
                    limit: 20,
                    page: 1
                }
            });

            if (!response.data.response || !response.data.response.contactClasses) {
                throw new Error('Invalid response format from Agentbox API');
            }

            console.log(`Retrieved ${response.data.response.contactClasses.length} contact classes`);
            return response.data.response.contactClasses;
        } catch (error) {
            console.error('Error fetching contact classes:', error.response?.data || error.message);
            throw error;
        }
    }

    async getContactSources() {
        try {
            const response = await this.client.get('/contact-sources', {
                params: {
                    version: 2,
                    limit: 20,
                    page: 1
                }
            });

            if (!response.data.response || !response.data.response.contactSources) {
                throw new Error('Invalid response format from Agentbox API');
            }

            console.log(`Retrieved ${response.data.response.contactSources.length} contact sources`);
            return response.data.response.contactSources;
        } catch (error) {
            console.error('Error fetching contact sources:', error.response?.data || error.message);
            throw error;
        }
    }

    async getOffices() {
        try {
            const response = await this.client.get('/offices', {
                params: {
                    version: 2,
                    limit: 20,
                    page: 1
                }
            });

            if (!response.data.response || !response.data.response.offices) {
                throw new Error('Invalid response format from Agentbox API');
            }

            console.log(`Retrieved ${response.data.response.offices.length} offices`);
            return response.data.response.offices;
        } catch (error) {
            console.error('Error fetching offices:', error.response?.data || error.message);
            throw error;
        }
    }

    // Add more methods for other Agentbox endpoints as needed
}

module.exports = AgentboxClient; 