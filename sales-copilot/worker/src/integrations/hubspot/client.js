const { Client } = require('@hubspot/api-client');
const logger = require('../../services/logger');

class HubspotClient {
    constructor(accessToken) {
        if (!accessToken) {
            throw new Error('HubSpot access token is required');
        }
        
        this.client = new Client({ accessToken });
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
}

module.exports = HubspotClient; 