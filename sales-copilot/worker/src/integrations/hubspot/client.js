const { Client } = require('@hubspot/api-client');
const Logger = require('../../services/logger');

// Initialize logger
const logger = new Logger();

class HubspotClient {
    constructor(accessToken) {
        if (!accessToken) {
            throw new Error('HubSpot access token is required');
        }
        
        this.client = new Client({
            accessToken,
            basePath: 'https://api.hubapi.com',
            defaultHeaders: {
                'Content-Type': 'application/json'
            }
        });
    }

    async getContact(contactId) {
        try {
            const apiResponse = await this.client.crm.contacts.basicApi.getById(contactId, [
                'email',
                'firstname',
                'lastname',
                'phone',
                'lifecyclestage',
                'hs_lead_status',
                'createdate',
                'lastmodifieddate'
            ]);
            
            return {
                id: apiResponse.id,
                email: apiResponse.properties.email,
                firstName: apiResponse.properties.firstname,
                lastName: apiResponse.properties.lastname,
                phone: apiResponse.properties.phone,
                lifecycleStage: apiResponse.properties.lifecyclestage,
                leadStatus: apiResponse.properties.hs_lead_status,
                createdAt: apiResponse.properties.createdate,
                updatedAt: apiResponse.properties.lastmodifieddate
            };
        } catch (error) {
            logger.error('Error fetching HubSpot contact:', error);
            throw error;
        }
    }

    async getDeal(dealId) {
        try {
            const apiResponse = await this.client.crm.deals.basicApi.getById(dealId, [
                'dealname',
                'dealstage',
                'amount',
                'closedate',
                'pipeline',
                'hs_lastmodifieddate',
                'createdate'
            ]);

            return {
                id: apiResponse.id,
                name: apiResponse.properties.dealname,
                dealStage: apiResponse.properties.dealstage,
                amount: apiResponse.properties.amount,
                closeDate: apiResponse.properties.closedate,
                pipeline: apiResponse.properties.pipeline,
                lastActivityDate: apiResponse.properties.hs_lastmodifieddate,
                createdAt: apiResponse.properties.createdate
            };
        } catch (error) {
            logger.error('Error fetching HubSpot deal:', error);
            throw error;
        }
    }

    async getEngagement(engagementId) {
        try {
            const apiResponse = await this.client.crm.engagements.basicApi.getById(engagementId, [
                'hs_engagement_type',
                'hs_engagement_source',
                'hs_engagement_source_id',
                'hs_timestamp',
                'hs_note_body'
            ]);

            return {
                id: apiResponse.id,
                type: apiResponse.properties.hs_engagement_type,
                source: apiResponse.properties.hs_engagement_source,
                sourceId: apiResponse.properties.hs_engagement_source_id,
                timestamp: apiResponse.properties.hs_timestamp,
                message: apiResponse.properties.hs_note_body
            };
        } catch (error) {
            logger.error('Error fetching HubSpot engagement:', error);
            throw error;
        }
    }

    async searchContacts(query) {
        try {
            const searchResponse = await this.client.crm.contacts.searchApi.doSearch({
                query,
                properties: [
                    'email',
                    'firstname',
                    'lastname',
                    'phone'
                ],
                limit: 10
            });

            return searchResponse.results.map(contact => ({
                id: contact.id,
                email: contact.properties.email,
                firstName: contact.properties.firstname,
                lastName: contact.properties.lastname,
                phone: contact.properties.phone
            }));
        } catch (error) {
            logger.error('Error searching HubSpot contacts:', error);
            throw error;
        }
    }

    async getRecentActivity(objectType, objectId, limit = 10) {
        try {
            const activities = await this.client.crm.activities.basicApi.getPage(
                undefined,
                undefined,
                limit,
                undefined,
                undefined,
                undefined,
                undefined,
                {
                    objectType,
                    objectId
                }
            );

            return activities.results.map(activity => ({
                id: activity.id,
                type: activity.type,
                timestamp: activity.createdAt,
                source: activity.source,
                sourceId: activity.sourceId
            }));
        } catch (error) {
            logger.error('Error fetching HubSpot activities:', error);
            throw error;
        }
    }

    async getCompany(companyId) {
        try {
            const apiResponse = await this.client.crm.companies.basicApi.getById(companyId, [
                'name',
                'domain',
                'industry',
                'type',
                'city',
                'state',
                'country',
                'phone',
                'lifecyclestage',
                'createdate',
                'hs_lastmodifieddate'
            ]);
            
            return {
                id: apiResponse.id,
                name: apiResponse.properties.name,
                domain: apiResponse.properties.domain,
                industry: apiResponse.properties.industry,
                type: apiResponse.properties.type,
                city: apiResponse.properties.city,
                state: apiResponse.properties.state,
                country: apiResponse.properties.country,
                phone: apiResponse.properties.phone,
                lifecycleStage: apiResponse.properties.lifecyclestage,
                createdAt: apiResponse.properties.createdate,
                updatedAt: apiResponse.properties.hs_lastmodifieddate
            };
        } catch (error) {
            logger.error('Error fetching HubSpot company:', error);
            throw error;
        }
    }

    async searchCompanies(query) {
        try {
            const searchResponse = await this.client.crm.companies.searchApi.doSearch({
                query,
                properties: [
                    'name',
                    'domain',
                    'industry',
                    'type',
                    'phone'
                ],
                limit: 10
            });

            return searchResponse.results.map(company => ({
                id: company.id,
                name: company.properties.name,
                domain: company.properties.domain,
                industry: company.properties.industry,
                type: company.properties.type,
                phone: company.properties.phone
            }));
        } catch (error) {
            logger.error('Error searching HubSpot companies:', error);
            throw error;
        }
    }

    async getLineItem(lineItemId) {
        try {
            const apiResponse = await this.client.crm.lineItems.basicApi.getById(lineItemId, [
                'name',
                'quantity',
                'price',
                'hs_product_id',
                'description',
                'hs_sku',
                'tax',
                'hs_deal_id',
                'createdate',
                'hs_lastmodifieddate'
            ]);

            return {
                id: apiResponse.id,
                name: apiResponse.properties.name,
                quantity: Number(apiResponse.properties.quantity),
                price: Number(apiResponse.properties.price),
                dealId: apiResponse.properties.hs_deal_id,
                sku: apiResponse.properties.hs_sku,
                description: apiResponse.properties.description,
                tax: Number(apiResponse.properties.tax),
                createdAt: apiResponse.properties.createdate,
                updatedAt: apiResponse.properties.hs_lastmodifieddate
            };
        } catch (error) {
            logger.error('Error fetching HubSpot line item:', error);
            throw error;
        }
    }

    async getLineItemsByDeal(dealId) {
        try {
            const searchResponse = await this.client.crm.lineItems.basicApi.getPage(
                undefined,
                undefined,
                100,
                undefined,
                undefined,
                undefined,
                undefined,
                {
                    filters: [
                        {
                            propertyName: 'hs_deal_id',
                            operator: 'EQ',
                            value: dealId
                        }
                    ]
                }
            );

            return searchResponse.results.map(item => ({
                id: item.id,
                name: item.properties.name,
                quantity: Number(item.properties.quantity),
                price: Number(item.properties.price),
                dealId: item.properties.hs_deal_id,
                sku: item.properties.hs_sku,
                description: item.properties.description,
                tax: Number(item.properties.tax)
            }));
        } catch (error) {
            logger.error('Error fetching HubSpot line items for deal:', error);
            throw error;
        }
    }

    async updateLeadScore(contactId, scoreData) {
        try {
            const properties = {
                ai_lead_score: scoreData.score.toString(),
                ai_lead_fit: scoreData.leadFit,
                ai_close_probability: scoreData.closeProbability.toString(),
                ai_next_best_action: scoreData.nextBestAction
            };

            await this.client.crm.contacts.basicApi.update(contactId, { properties });

            // Trigger workflow for high priority leads
            if (scoreData.score >= 80) {
                await this.triggerHighPriorityLeadWorkflow(contactId);
            }

            return true;
        } catch (error) {
            logger.error('Error updating HubSpot lead score:', error);
            throw error;
        }
    }

    async getContactWithCompany(contactId) {
        try {
            const [contact, associations] = await Promise.all([
                this.getContact(contactId),
                this.client.crm.contacts.associationsApi.getAll(contactId, 'company')
            ]);

            if (associations.results.length > 0) {
                const companyId = associations.results[0].id;
                const company = await this.getCompany(companyId);
                return { ...contact, company };
            }

            return contact;
        } catch (error) {
            logger.error('Error fetching contact with company:', error);
            throw error;
        }
    }

    async getContactEngagementMetrics(contactId) {
        try {
            const engagements = await this.client.crm.engagements.getAll(contactId);
            
            const metrics = {
                totalEngagements: 0,
                emailsOpened: 0,
                emailsReplied: 0,
                meetingsAttended: 0,
                callsAnswered: 0,
                lastEngagementDate: null
            };

            for (const engagement of engagements.results) {
                metrics.totalEngagements++;

                switch (engagement.type) {
                    case 'EMAIL':
                        if (engagement.properties.opened) metrics.emailsOpened++;
                        if (engagement.properties.replied) metrics.emailsReplied++;
                        break;
                    case 'MEETING':
                        if (engagement.properties.attended) metrics.meetingsAttended++;
                        break;
                    case 'CALL':
                        if (engagement.properties.status === 'COMPLETED') metrics.callsAnswered++;
                        break;
                }

                const engagementDate = new Date(engagement.createdAt);
                if (!metrics.lastEngagementDate || engagementDate > metrics.lastEngagementDate) {
                    metrics.lastEngagementDate = engagementDate;
                }
            }

            return metrics;
        } catch (error) {
            logger.error('Error fetching contact engagement metrics:', error);
            throw error;
        }
    }

    async getContactDealHistory(contactId) {
        try {
            const deals = await this.client.crm.deals.associationsApi.getAll(contactId, 'deal');
            
            const history = {
                totalDeals: 0,
                wonDeals: 0,
                lostDeals: 0,
                totalValue: 0,
                averageDealSize: 0,
                averageSalesCycle: 0
            };

            for (const deal of deals.results) {
                history.totalDeals++;
                
                if (deal.properties.dealstage === 'closedwon') {
                    history.wonDeals++;
                    history.totalValue += Number(deal.properties.amount) || 0;
                } else if (deal.properties.dealstage === 'closedlost') {
                    history.lostDeals++;
                }

                if (deal.properties.closedate && deal.properties.createdate) {
                    const cycleTime = new Date(deal.properties.closedate) - new Date(deal.properties.createdate);
                    history.averageSalesCycle += cycleTime;
                }
            }

            if (history.wonDeals > 0) {
                history.averageDealSize = history.totalValue / history.wonDeals;
                history.averageSalesCycle = history.averageSalesCycle / history.wonDeals;
            }

            return history;
        } catch (error) {
            logger.error('Error fetching contact deal history:', error);
            throw error;
        }
    }

    async triggerHighPriorityLeadWorkflow(contactId) {
        try {
            const workflowId = process.env.HUBSPOT_HIGH_PRIORITY_WORKFLOW_ID;
            if (!workflowId) {
                throw new Error('High priority workflow ID not configured');
            }

            await this.client.automation.workflowsApi.enrollObject(workflowId, {
                objectId: contactId,
                objectType: 'CONTACT'
            });
        } catch (error) {
            logger.error('Error triggering high priority lead workflow:', error);
            throw error;
        }
    }

    async findListByName(listName) {
        try {
            // Search for lists using the search endpoint
            const response = await this.client.apiRequest({
                method: 'POST',
                path: '/crm/v3/lists/search',
                body: {
                    query: listName,
                    processingTypes: ["MANUAL", "DYNAMIC"]
                }
            });

            const data = await response.json();
            logger.info('HubSpot lists response:', {
                requestedName: listName,
                responseData: data,
                availableLists: data.lists ? data.lists.map(l => l.name) : []
            });

            if (!data.lists || data.lists.length === 0) {
                throw new Error(`No list found with name: ${listName}`);
            }

            const matchingList = data.lists.find(list => list.name === listName);
            if (!matchingList) {
                throw new Error(`No list found with name: ${listName}`);
            }

            return {
                id: matchingList.listId,
                name: matchingList.name,
                size: matchingList.additionalProperties?.hs_list_size || 0
            };
        } catch (error) {
            logger.error('Error finding HubSpot list:', {
                requestedName: listName,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async getContactsFromList(listId, properties = [
        'email',
        'firstname',
        'lastname',
        'phone',
        'company',
        'industry',
        'lifecyclestage',
        'hs_lead_status'
    ]) {
        try {
            // Get list members using the list membership endpoint
            const response = await this.client.apiRequest({
                method: 'GET',
                path: `/contacts/v1/lists/${listId}/contacts/all`,
                qs: {
                    property: properties
                }
            });

            const data = await response.json();
            logger.info('HubSpot list contacts response:', {
                listId,
                contactCount: data.contacts ? data.contacts.length : 0
            });

            if (!data.contacts) {
                return [];
            }
            
            return data.contacts.map(contact => ({
                id: contact.vid,
                email: contact.properties.email?.value,
                firstName: contact.properties.firstname?.value,
                lastName: contact.properties.lastname?.value,
                phone: contact.properties.phone?.value,
                company: contact.properties.company?.value,
                industry: contact.properties.industry?.value,
                lifecycleStage: contact.properties.lifecyclestage?.value,
                leadStatus: contact.properties.hs_lead_status?.value
            }));
        } catch (error) {
            logger.error('Error getting contacts from HubSpot list:', {
                listId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async getCompaniesFromList(listId, properties = [
        'name',
        'domain',
        'industry',
        'type',
        'city',
        'state',
        'country',
        'phone',
        'lifecyclestage'
    ]) {
        try {
            // Get list members using associations API
            const companies = await this.client.crm.objects.associationsApi.getAll(
                'lists',
                listId,
                'companies'
            );

            // Get full company details for each member
            const detailedCompanies = await Promise.all(
                companies.results.map(company => 
                    this.client.crm.companies.basicApi.getById(company.id, properties)
                )
            );
            
            return detailedCompanies.map(company => ({
                id: company.id,
                name: company.properties.name,
                domain: company.properties.domain,
                industry: company.properties.industry,
                type: company.properties.type,
                city: company.properties.city,
                state: company.properties.state,
                country: company.properties.country,
                phone: company.properties.phone,
                lifecycleStage: company.properties.lifecyclestage
            }));
        } catch (error) {
            logger.error('Error getting companies from HubSpot list:', error);
            throw error;
        }
    }

    async getDetailedCompanyInfo(companyId) {
        try {
            // Fetch all information in parallel
            const [
                companyDetails,
                associatedContacts,
                associatedDeals,
                recentActivity
            ] = await Promise.all([
                this.getCompany(companyId),
                this.client.crm.companies.associationsApi.getAll(companyId, 'contacts'),
                this.client.crm.companies.associationsApi.getAll(companyId, 'deals'),
                this.getRecentActivity('company', companyId, 10)
            ]);

            // Get full deal details
            const deals = await Promise.all(
                associatedDeals.results.map(deal => this.getDeal(deal.id))
            );

            // Calculate company-level metrics
            const metrics = {
                totalRevenue: deals.reduce((sum, deal) => 
                    sum + (Number(deal.amount) || 0), 0),
                dealCount: deals.length,
                wonDeals: deals.filter(deal => 
                    deal.dealStage === 'closedwon').length,
                contactCount: associatedContacts.results.length,
                averageDealSize: 0,
                averageSalesCycle: 0
            };

            // Calculate average deal size and sales cycle
            const wonDealsData = deals.filter(deal => deal.dealStage === 'closedwon');
            if (wonDealsData.length > 0) {
                metrics.averageDealSize = metrics.totalRevenue / wonDealsData.length;
                metrics.averageSalesCycle = wonDealsData.reduce((sum, deal) => {
                    const cycleTime = new Date(deal.closeDate) - new Date(deal.createdAt);
                    return sum + cycleTime;
                }, 0) / wonDealsData.length;
            }

            return {
                ...companyDetails,
                metrics,
                deals,
                recentActivity
            };
        } catch (error) {
            logger.error('Error getting detailed company info:', error);
            throw error;
        }
    }

    async getIdealAndLessIdealData(type = 'contacts') {
        try {
            const isCompanyType = type.toLowerCase() === 'companies';
            const listSuffix = isCompanyType ? 'Companies' : 'Contacts';
            
            // Find both lists
            const [idealList, lessIdealList] = await Promise.all([
                this.findListByName(`Ideal-${listSuffix}`),
                this.findListByName(`Less-Ideal-${listSuffix}`)
            ]);

            if (isCompanyType) {
                // Get companies from both lists
                const [idealCompanies, lessIdealCompanies] = await Promise.all([
                    this.getCompaniesFromList(idealList.id),
                    this.getCompaniesFromList(lessIdealList.id)
                ]);

                return {
                    ideal: idealCompanies,
                    lessIdeal: lessIdealCompanies,
                    type: 'companies'
                };
            } else {
                // Get contacts from both lists
                const [idealContacts, lessIdealContacts] = await Promise.all([
                    this.getContactsFromList(idealList.id),
                    this.getContactsFromList(lessIdealList.id)
                ]);

                return {
                    ideal: idealContacts,
                    lessIdeal: lessIdealContacts,
                    type: 'contacts'
                };
            }
        } catch (error) {
            logger.error(`Error getting ideal and less-ideal ${type}:`, error);
            throw error;
        }
    }

    async getDetailedIdealAndLessIdealData(type = 'contacts') {
        try {
            // First get basic info from lists
            const basicData = await this.getIdealAndLessIdealData(type);
            const isCompanyType = type.toLowerCase() === 'companies';

            // Get detailed info for each record
            const [detailedIdeal, detailedLessIdeal] = await Promise.all([
                Promise.all(basicData.ideal.map(record => 
                    isCompanyType ? 
                    this.getDetailedCompanyInfo(record.id) : 
                    this.getDetailedContactInfo(record.id)
                )),
                Promise.all(basicData.lessIdeal.map(record => 
                    isCompanyType ? 
                    this.getDetailedCompanyInfo(record.id) : 
                    this.getDetailedContactInfo(record.id)
                ))
            ]);

            return {
                ideal: detailedIdeal,
                lessIdeal: detailedLessIdeal,
                type: basicData.type,
                summary: {
                    idealCount: detailedIdeal.length,
                    lessIdealCount: detailedLessIdeal.length,
                    idealMetrics: isCompanyType ? 
                        this.calculateCompanyGroupMetrics(detailedIdeal) : 
                        this.calculateContactGroupMetrics(detailedIdeal),
                    lessIdealMetrics: isCompanyType ? 
                        this.calculateCompanyGroupMetrics(detailedLessIdeal) : 
                        this.calculateContactGroupMetrics(detailedLessIdeal)
                }
            };
        } catch (error) {
            logger.error(`Error getting detailed ideal and less-ideal ${type}:`, error);
            throw error;
        }
    }

    calculateContactGroupMetrics(contacts) {
        const metrics = {
            totalDeals: 0,
            totalWonDeals: 0,
            totalLostDeals: 0,
            totalDealValue: 0,
            averageDealSize: 0,
            averageEngagementRate: 0,
            commonIndustries: {},
            averageEmailOpenRate: 0,
            averageEmailReplyRate: 0,
            totalEngagements: 0
        };

        contacts.forEach(contact => {
            // Deal metrics
            metrics.totalDeals += contact.dealHistory.totalDeals;
            metrics.totalWonDeals += contact.dealHistory.wonDeals;
            metrics.totalLostDeals += contact.dealHistory.lostDeals;
            metrics.totalDealValue += contact.dealHistory.totalValue;

            // Engagement metrics
            metrics.totalEngagements += contact.engagementMetrics.totalEngagements;
            
            // Industry tracking
            if (contact.company?.industry) {
                metrics.commonIndustries[contact.company.industry] = 
                    (metrics.commonIndustries[contact.company.industry] || 0) + 1;
            }
        });

        // Calculate averages
        const contactCount = contacts.length;
        if (contactCount > 0) {
            metrics.averageDealSize = metrics.totalDealValue / metrics.totalWonDeals || 0;
            metrics.averageEngagementRate = metrics.totalEngagements / contactCount;
        }

        // Sort and limit industries to top 5
        metrics.commonIndustries = Object.entries(metrics.commonIndustries)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .reduce((obj, [key, value]) => ({
                ...obj,
                [key]: value
            }), {});

        return metrics;
    }

    calculateCompanyGroupMetrics(companies) {
        const metrics = {
            totalRevenue: 0,
            totalDeals: 0,
            wonDeals: 0,
            lostDeals: 0,
            averageDealSize: 0,
            averageSalesCycle: 0,
            totalContacts: 0,
            commonIndustries: {},
            companySizes: {},
            averageDealsPerCompany: 0
        };

        companies.forEach(company => {
            // Revenue and deal metrics
            metrics.totalRevenue += company.metrics.totalRevenue;
            metrics.totalDeals += company.metrics.dealCount;
            metrics.wonDeals += company.metrics.wonDeals;
            metrics.totalContacts += company.metrics.contactCount;

            // Industry tracking
            if (company.industry) {
                metrics.commonIndustries[company.industry] = 
                    (metrics.commonIndustries[company.industry] || 0) + 1;
            }

            // Company size tracking (if available)
            if (company.size) {
                metrics.companySizes[company.size] = 
                    (metrics.companySizes[company.size] || 0) + 1;
            }
        });

        // Calculate averages
        const companyCount = companies.length;
        if (companyCount > 0) {
            metrics.averageDealSize = metrics.totalRevenue / metrics.wonDeals || 0;
            metrics.averageDealsPerCompany = metrics.totalDeals / companyCount;
        }

        // Sort and limit industries and company sizes to top 5
        metrics.commonIndustries = this.getTopCategories(metrics.commonIndustries);
        metrics.companySizes = this.getTopCategories(metrics.companySizes);

        return metrics;
    }

    getTopCategories(categories, limit = 5) {
        return Object.entries(categories)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .reduce((obj, [key, value]) => ({
                ...obj,
                [key]: value
            }), {});
    }
}

module.exports = HubspotClient; 