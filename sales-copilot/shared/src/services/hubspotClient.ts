import { 
  HubspotClientInterface, 
  HubspotList, 
  HubspotContact, 
  HubspotCompany, 
  HubspotDeal,
  IdealClientData
} from '../types';
import { logger } from '../utils/logger';

/**
 * HubspotClient implementation that works in both Node.js and Deno environments
 */
export class HubspotClient implements HubspotClientInterface {
  private client: any;
  
  constructor(accessToken: string) {
    // Create a simple fetch-based client that works in both environments
    this.client = {
      apiRequest: async (options: any) => {
        const url = `https://api.hubapi.com${options.path}${options.query ? '?' + new URLSearchParams(options.query).toString() : ''}`;
        const response = await fetch(url, {
          method: options.method || 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: options.body ? JSON.stringify(options.body) : undefined
        });
        
        if (!response.ok) {
          throw new Error(`HubSpot API error: ${response.status} ${response.statusText}`);
        }
        
        return response;
      }
    };
  }
  
  async findListByName(listName: string): Promise<HubspotList> {
    try {
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
        availableLists: data.lists ? data.lists.map((l: any) => l.name) : []
      });

      if (!data.lists || data.lists.length === 0) {
        throw new Error(`No list found with name: ${listName}`);
      }

      const matchingList = data.lists.find((list: any) => list.name === listName);
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
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  async getContactsFromList(listId: string): Promise<HubspotContact[]> {
    try {
      // Get list memberships
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/lists/${listId}/memberships`,
        query: {
          limit: 100
        }
      });

      const data = await response.json();
      logger.info('HubSpot list contacts response:', {
        listId,
        contactCount: data.results ? data.results.length : 0
      });

      if (!data.results || data.results.length === 0) {
        return [];
      }

      // Get full contact details with associations for each member
      const contactIds = data.results.map((result: any) => result.recordId);
      const contacts = await Promise.all(
        contactIds.map(async (id: string) => {
          try {
            // Get contact with associations
            const contactResponse = await this.client.apiRequest({
              method: 'GET',
              path: `/crm/v3/objects/contacts/${id}`,
              query: {
                properties: [
                  'email',
                  'firstname',
                  'lastname',
                  'phone',
                  'company',
                  'industry',
                  'lifecyclestage',
                  'hs_lead_status',
                  'jobtitle',
                  'createdate',
                  'lastmodifieddate'
                ],
                associations: ['companies', 'deals']
              }
            });
            
            const contact = await contactResponse.json();
            
            // Get associated company details if any exist
            let companies: any[] = [];
            if (contact.associations?.companies?.results?.length > 0) {
              companies = await Promise.all(
                contact.associations.companies.results.map(async (company: any) => {
                  const companyResponse = await this.client.apiRequest({
                    method: 'GET',
                    path: `/crm/v3/objects/companies/${company.id}`,
                    query: {
                      properties: [
                        'name',
                        'domain',
                        'industry',
                        'numberofemployees',
                        'annualrevenue',
                        'type',
                        'description'
                      ]
                    }
                  });
                  return companyResponse.json();
                })
              );
            }

            // Get associated deal details if any exist
            let deals: any[] = [];
            if (contact.associations?.deals?.results?.length > 0) {
              deals = await Promise.all(
                contact.associations.deals.results.map(async (deal: any) => {
                  const dealResponse = await this.client.apiRequest({
                    method: 'GET',
                    path: `/crm/v3/objects/deals/${deal.id}`,
                    query: {
                      properties: [
                        'dealname',
                        'dealstage',
                        'amount',
                        'closedate',
                        'pipeline',
                        'dealtype'
                      ]
                    }
                  });
                  return dealResponse.json();
                })
              );
            }

            return {
              ...contact,
              enriched: {
                companies,
                deals
              }
            };
          } catch (error) {
            logger.error(`Error fetching details for contact ${id}:`, error);
            return null;
          }
        })
      );
      
      // Filter out any null results from failed fetches
      return contacts.filter(contact => contact !== null) as HubspotContact[];
    } catch (error) {
      logger.error('Error getting contacts from HubSpot list:', {
        listId,
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  async getCompaniesFromList(listId: string): Promise<HubspotCompany[]> {
    try {
      // Get list memberships
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/lists/${listId}/memberships`,
        query: {
          limit: 100
        }
      });

      const data = await response.json();
      logger.info('HubSpot list companies response:', {
        listId,
        companyCount: data.results ? data.results.length : 0
      });

      if (!data.results || data.results.length === 0) {
        return [];
      }

      // Get full company details with associations for each member
      const companyIds = data.results.map((result: any) => result.recordId);
      const companies = await Promise.all(
        companyIds.map(async (id: string) => {
          try {
            // Get company with associations
            const companyResponse = await this.client.apiRequest({
              method: 'GET',
              path: `/crm/v3/objects/companies/${id}`,
              query: {
                properties: [
                  'name',
                  'domain',
                  'industry',
                  'type',
                  'city',
                  'state',
                  'country',
                  'phone',
                  'lifecyclestage',
                  'numberofemployees',
                  'annualrevenue',
                  'description',
                  'createdate',
                  'hs_lastmodifieddate'
                ],
                associations: ['contacts', 'deals']
              }
            });
            
            const company = await companyResponse.json();
            
            // Get associated contact details if any exist
            let contacts: any[] = [];
            if (company.associations?.contacts?.results?.length > 0) {
              contacts = await Promise.all(
                company.associations.contacts.results.map(async (contact: any) => {
                  const contactResponse = await this.client.apiRequest({
                    method: 'GET',
                    path: `/crm/v3/objects/contacts/${contact.id}`,
                    query: {
                      properties: [
                        'email',
                        'firstname',
                        'lastname',
                        'jobtitle',
                        'lifecyclestage',
                        'hs_lead_status',
                        'createdate',
                        'lastmodifieddate'
                      ]
                    }
                  });
                  return contactResponse.json();
                })
              );
            }

            // Get associated deal details if any exist
            let deals: any[] = [];
            if (company.associations?.deals?.results?.length > 0) {
              deals = await Promise.all(
                company.associations.deals.results.map(async (deal: any) => {
                  const dealResponse = await this.client.apiRequest({
                    method: 'GET',
                    path: `/crm/v3/objects/deals/${deal.id}`,
                    query: {
                      properties: [
                        'dealname',
                        'dealstage',
                        'amount',
                        'closedate',
                        'pipeline',
                        'dealtype',
                        'createdate',
                        'hs_lastmodifieddate'
                      ]
                    }
                  });
                  return dealResponse.json();
                })
              );
            }

            // Calculate company metrics
            const metrics = {
              totalRevenue: deals.reduce((sum: number, deal: any) => 
                sum + (Number(deal.properties?.amount) || 0), 0),
              totalDeals: deals.length,
              wonDeals: deals.filter((deal: any) => 
                deal.properties?.dealstage === 'closedwon').length,
              activeContacts: contacts.filter((contact: any) => 
                contact.properties?.hs_lead_status === 'active').length,
              totalContacts: contacts.length
            };

            return {
              ...company,
              enriched: {
                contacts,
                deals,
                metrics
              }
            };
          } catch (error) {
            logger.error(`Error fetching details for company ${id}:`, error);
            return null;
          }
        })
      );
      
      // Filter out any null results from failed fetches
      return companies.filter(company => company !== null) as HubspotCompany[];
    } catch (error) {
      logger.error('Error getting companies from HubSpot list:', {
        listId,
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  async getDealsFromList(listId: string): Promise<HubspotDeal[]> {
    try {
      // Get list memberships
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/lists/${listId}/memberships`,
        query: {
          limit: 100
        }
      });

      const data = await response.json();
      logger.info('HubSpot list deals response:', {
        listId,
        dealCount: data.results ? data.results.length : 0
      });

      if (!data.results || data.results.length === 0) {
        return [];
      }

      // Get full deal details with associations for each member
      const dealIds = data.results.map((result: any) => result.recordId);
      const deals = await Promise.all(
        dealIds.map(async (id: string) => {
          try {
            // Get deal with associations
            const dealResponse = await this.client.apiRequest({
              method: 'GET',
              path: `/crm/v3/objects/deals/${id}`,
              query: {
                properties: [
                  'dealname',
                  'dealstage',
                  'amount',
                  'closedate',
                  'pipeline',
                  'dealtype',
                  'createdate',
                  'hs_lastmodifieddate',
                  'description',
                  'hs_priority'
                ],
                associations: ['contacts', 'companies', 'line_items']
              }
            });
            
            const deal = await dealResponse.json();
            
            // Get associated contact details if any exist
            let contacts: any[] = [];
            if (deal.associations?.contacts?.results?.length > 0) {
              contacts = await Promise.all(
                deal.associations.contacts.results.map(async (contact: any) => {
                  const contactResponse = await this.client.apiRequest({
                    method: 'GET',
                    path: `/crm/v3/objects/contacts/${contact.id}`,
                    query: {
                      properties: [
                        'email',
                        'firstname',
                        'lastname',
                        'jobtitle',
                        'lifecyclestage',
                        'hs_lead_status'
                      ]
                    }
                  });
                  return contactResponse.json();
                })
              );
            }

            // Get associated company details if any exist
            let companies: any[] = [];
            if (deal.associations?.companies?.results?.length > 0) {
              companies = await Promise.all(
                deal.associations.companies.results.map(async (company: any) => {
                  const companyResponse = await this.client.apiRequest({
                    method: 'GET',
                    path: `/crm/v3/objects/companies/${company.id}`,
                    query: {
                      properties: [
                        'name',
                        'domain',
                        'industry',
                        'numberofemployees',
                        'annualrevenue',
                        'type'
                      ]
                    }
                  });
                  return companyResponse.json();
                })
              );
            }

            // Get associated line items if any exist
            let lineItems: any[] = [];
            if (deal.associations?.line_items?.results?.length > 0) {
              lineItems = await Promise.all(
                deal.associations.line_items.results.map(async (lineItem: any) => {
                  const lineItemResponse = await this.client.apiRequest({
                    method: 'GET',
                    path: `/crm/v3/objects/line_items/${lineItem.id}`,
                    query: {
                      properties: [
                        'name',
                        'quantity',
                        'price',
                        'amount',
                        'description',
                        'hs_sku'
                      ]
                    }
                  });
                  return lineItemResponse.json();
                })
              );
            }

            // Calculate deal metrics
            const metrics = {
              totalValue: Number(deal.properties?.amount) || 0,
              lineItemCount: lineItems.length,
              contactCount: contacts.length,
              companyCount: companies.length,
              salesCycleDays: deal.properties?.closedate && deal.properties?.createdate ? 
                Math.round((new Date(deal.properties.closedate).getTime() - new Date(deal.properties.createdate).getTime()) / (1000 * 60 * 60 * 24)) : 
                null
            };

            return {
              ...deal,
              enriched: {
                contacts,
                companies,
                lineItems,
                metrics
              }
            };
          } catch (error) {
            logger.error(`Error fetching details for deal ${id}:`, error);
            return null;
          }
        })
      );
      
      // Filter out any null results from failed fetches
      return deals.filter(deal => deal !== null) as HubspotDeal[];
    } catch (error) {
      logger.error('Error getting deals from HubSpot list:', {
        listId,
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  async getIdealAndLessIdealData(type = 'contacts'): Promise<IdealClientData> {
    try {
      // Validate type
      const validTypes = ['contacts', 'companies', 'deals'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`);
      }

      const listSuffix = type.charAt(0).toUpperCase() + type.slice(1);
      
      // Find both lists
      const [idealList, lessIdealList] = await Promise.all([
        this.findListByName(`Ideal-${listSuffix}`),
        this.findListByName(`Less-Ideal-${listSuffix}`)
      ]);

      // Get records from both lists based on type
      let idealRecords, lessIdealRecords;
      
      if (type === 'contacts') {
        [idealRecords, lessIdealRecords] = await Promise.all([
          this.getContactsFromList(idealList.id),
          this.getContactsFromList(lessIdealList.id)
        ]);
      } else if (type === 'companies') {
        [idealRecords, lessIdealRecords] = await Promise.all([
          this.getCompaniesFromList(idealList.id),
          this.getCompaniesFromList(lessIdealList.id)
        ]);
      } else if (type === 'deals') {
        [idealRecords, lessIdealRecords] = await Promise.all([
          this.getDealsFromList(idealList.id),
          this.getDealsFromList(lessIdealList.id)
        ]);
      }

      return {
        ideal: idealRecords || [],
        lessIdeal: lessIdealRecords || [],
        type: type
      };
    } catch (error) {
      logger.error(`Error getting ideal and less-ideal ${type}:`, error);
      throw error;
    }
  }
} 