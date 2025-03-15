import { 
  HubspotClientInterface, 
  HubspotList, 
  HubspotContact, 
  HubspotCompany, 
  HubspotDeal,
  IdealClientData,
  HubspotRecord,
  PropertyGroup,
  Property,
  SearchRequest,
  SearchResponse
} from '../types';
import { logger } from '../utils/logger';
import { Logger } from '../utils/logger';

/**
 * HubspotClient implementation that works in both Node.js and Deno environments
 */
export class HubspotClient implements HubspotClientInterface {
  private client: any;
  private baseUrl = 'https://api.hubapi.com';
  private logger: Logger;
  private accessToken: string;
  
  constructor(
    accessToken: string,
    logger?: Logger
  ) {
    this.accessToken = accessToken;
    this.logger = logger || new Logger('hubspot-client');
    // Create a simple fetch-based client that works in both environments
    this.client = {
      apiRequest: async (options: any) => {
        const url = `${this.baseUrl}${options.path}${options.query ? '?' + new URLSearchParams(options.query).toString() : ''}`;
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
      this.logger.info('HubSpot lists response:', {
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
      this.logger.error('Error finding HubSpot list:', {
        requestedName: listName,
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  async getContactsFromList(listId: string): Promise<HubspotContact[]> {
    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/lists/${listId}/memberships`,
        query: {
          limit: 100
        }
      });

      const data = await response.json();
      this.logger.info('HubSpot list contacts response:', {
        listId,
        contactCount: data.results ? data.results.length : 0
      });

      if (!data.results || data.results.length === 0) {
        return [];
      }

      const contactIds = data.results.map((result: any) => result.recordId);
      const contacts = await Promise.all(
        contactIds.map(async (id: string) => {
          try {
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
            this.logger.error(`Error fetching details for contact ${id}:`, error);
            return null;
          }
        })
      );
      
      return contacts.filter(contact => contact !== null) as HubspotContact[];
    } catch (error) {
      this.logger.error('Error getting contacts from HubSpot list:', {
        listId,
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  async getCompaniesFromList(listId: string): Promise<HubspotCompany[]> {
    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/lists/${listId}/memberships`,
        query: {
          limit: 100
        }
      });

      const data = await response.json();
      this.logger.info('HubSpot list companies response:', {
        listId,
        companyCount: data.results ? data.results.length : 0
      });

      if (!data.results || data.results.length === 0) {
        return [];
      }

      const companyIds = data.results.map((result: any) => result.recordId);
      const companies = await Promise.all(
        companyIds.map(async (id: string) => {
          try {
            const companyResponse = await this.client.apiRequest({
              method: 'GET',
              path: `/crm/v3/objects/companies/${id}`,
              query: {
                properties: [
                  'name',
                  'domain',
                  'industry',
                  'numberofemployees',
                  'annualrevenue',
                  'type',
                  'description',
                  'createdate',
                  'lastmodifieddate'
                ],
                associations: ['contacts', 'deals']
              }
            });
            
            const company = await companyResponse.json();
            
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
                        'phone',
                        'jobtitle'
                      ]
                    }
                  });
                  return contactResponse.json();
                })
              );
            }

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
                        'dealtype'
                      ]
                    }
                  });
                  return dealResponse.json();
                })
              );
            }

            return {
              ...company,
              enriched: {
                contacts,
                deals,
                metrics: {
                  totalRevenue: deals.reduce((sum, deal) => sum + (parseFloat(deal.properties.amount) || 0), 0),
                  totalDeals: deals.length,
                  wonDeals: deals.filter(deal => deal.properties.dealstage === 'closedwon').length,
                  activeContacts: contacts.filter(contact => contact.properties.hs_lead_status === 'active').length,
                  totalContacts: contacts.length
                }
              }
            };
          } catch (error) {
            this.logger.error(`Error fetching details for company ${id}:`, error);
            return null;
          }
        })
      );
      
      return companies.filter(company => company !== null) as HubspotCompany[];
    } catch (error) {
      this.logger.error('Error getting companies from HubSpot list:', {
        listId,
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  async getDealsFromList(listId: string): Promise<HubspotDeal[]> {
    try {
      const response = await this.client.apiRequest({
        method: 'GET',
        path: `/crm/v3/lists/${listId}/memberships`,
        query: {
          limit: 100
        }
      });

      const data = await response.json();
      this.logger.info('HubSpot list deals response:', {
        listId,
        dealCount: data.results ? data.results.length : 0
      });

      if (!data.results || data.results.length === 0) {
        return [];
      }

      const dealIds = data.results.map((result: any) => result.recordId);
      const deals = await Promise.all(
        dealIds.map(async (id: string) => {
          try {
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
                  'lastmodifieddate'
                ],
                associations: ['contacts', 'companies', 'line_items']
              }
            });
            
            const deal = await dealResponse.json();
            
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
                        'phone',
                        'jobtitle'
                      ]
                    }
                  });
                  return contactResponse.json();
                })
              );
            }

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
                        'annualrevenue'
                      ]
                    }
                  });
                  return companyResponse.json();
                })
              );
            }

            let lineItems: any[] = [];
            if (deal.associations?.line_items?.results?.length > 0) {
              lineItems = await Promise.all(
                deal.associations.line_items.results.map(async (item: any) => {
                  const itemResponse = await this.client.apiRequest({
                    method: 'GET',
                    path: `/crm/v3/objects/line_items/${item.id}`,
                    query: {
                      properties: [
                        'name',
                        'quantity',
                        'price',
                        'amount'
                      ]
                    }
                  });
                  return itemResponse.json();
                })
              );
            }

            const createDate = new Date(deal.properties.createdate);
            const closeDate = new Date(deal.properties.closedate);
            const salesCycleDays = !isNaN(closeDate.getTime()) && !isNaN(createDate.getTime())
              ? Math.ceil((closeDate.getTime() - createDate.getTime()) / (1000 * 60 * 60 * 24))
              : null;

            return {
              ...deal,
              enriched: {
                contacts,
                companies,
                lineItems,
                metrics: {
                  totalValue: parseFloat(deal.properties.amount) || 0,
                  lineItemCount: lineItems.length,
                  contactCount: contacts.length,
                  companyCount: companies.length,
                  salesCycleDays
                }
              }
            };
          } catch (error) {
            this.logger.error(`Error fetching details for deal ${id}:`, error);
            return null;
          }
        })
      );
      
      return deals.filter(deal => deal !== null) as HubspotDeal[];
    } catch (error) {
      this.logger.error('Error getting deals from HubSpot list:', {
        listId,
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  async getIdealAndLessIdealData(type = 'contacts'): Promise<IdealClientData> {
    try {
      const idealListName = `Ideal ${type}`;
      const lessIdealListName = `Less Ideal ${type}`;
      
      const [idealList, lessIdealList] = await Promise.all([
        this.findListByName(idealListName),
        this.findListByName(lessIdealListName)
      ]);
      
      let ideal: any[] = [];
      let lessIdeal: any[] = [];
      
      if (type === 'contacts') {
        [ideal, lessIdeal] = await Promise.all([
          this.getContactsFromList(idealList.id),
          this.getContactsFromList(lessIdealList.id)
        ]);
      } else if (type === 'companies') {
        [ideal, lessIdeal] = await Promise.all([
          this.getCompaniesFromList(idealList.id),
          this.getCompaniesFromList(lessIdealList.id)
        ]);
      } else if (type === 'deals') {
        [ideal, lessIdeal] = await Promise.all([
          this.getDealsFromList(idealList.id),
          this.getDealsFromList(lessIdealList.id)
        ]);
      }
      
      return {
        ideal,
        lessIdeal,
        type
      };
    } catch (error) {
      this.logger.error('Error getting ideal and less ideal data:', {
        type,
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async getContact(id: string): Promise<HubspotRecord> {
    return this.makeRequest(`/crm/v3/objects/contacts/${id}`);
  }
  
  async getCompany(id: string): Promise<HubspotRecord> {
    return this.makeRequest(`/crm/v3/objects/companies/${id}`);
  }
  
  async getDeal(id: string): Promise<HubspotRecord> {
    return this.makeRequest(`/crm/v3/objects/deals/${id}`);
  }
  
  async updateContact(id: string, properties: Record<string, any>): Promise<HubspotRecord> {
    return this.makeRequest(`/crm/v3/objects/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }
  
  async updateCompany(id: string, properties: Record<string, any>): Promise<HubspotRecord> {
    return this.makeRequest(`/crm/v3/objects/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }
  
  async updateDeal(id: string, properties: Record<string, any>): Promise<HubspotRecord> {
    return this.makeRequest(`/crm/v3/objects/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }
  
  async createWebhookSubscription(
    portalId: string,
    appId: string,
    subscriptionDetails: {
      eventType: string;
      propertyName?: string;
      webhookUrl: string;
    }
  ): Promise<any> {
    return this.makeRequest(`/webhooks/v3/${portalId}/subscriptions`, {
      method: 'POST',
      body: JSON.stringify({
        ...subscriptionDetails,
        appId
      })
    });
  }
  
  async searchContacts(searchRequest: SearchRequest): Promise<SearchResponse<HubspotRecord>> {
    return this.makeRequest('/crm/v3/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify(searchRequest)
    });
  }
  
  async searchCompanies(searchRequest: SearchRequest): Promise<SearchResponse<HubspotRecord>> {
    return this.makeRequest('/crm/v3/objects/companies/search', {
      method: 'POST',
      body: JSON.stringify(searchRequest)
    });
  }
  
  async searchDeals(searchRequest: SearchRequest): Promise<SearchResponse<HubspotRecord>> {
    return this.makeRequest('/crm/v3/objects/deals/search', {
      method: 'POST',
      body: JSON.stringify(searchRequest)
    });
  }
  
  async createPropertyGroup(group: PropertyGroup): Promise<PropertyGroup> {
    return this.makeRequest('/properties/v2/groups', {
      method: 'POST',
      body: JSON.stringify(group)
    });
  }
  
  async createProperty(objectType: string, property: Property): Promise<Property> {
    return this.makeRequest(`/properties/v2/${objectType}/properties`, {
      method: 'POST',
      body: JSON.stringify(property)
    });
  }
} 