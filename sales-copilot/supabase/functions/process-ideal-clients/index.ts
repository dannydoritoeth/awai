import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Pinecone } from 'https://esm.sh/@pinecone-database/pinecone@1.1.0';
import { OpenAIEmbeddings } from 'https://esm.sh/@langchain/openai@0.0.10';
import { PineconeStore } from 'https://esm.sh/@langchain/pinecone@0.0.2';
import { Document } from 'https://esm.sh/@langchain/core/documents@0.0.8';

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const PINECONE_API_KEY = Deno.env.get('PINECONE_API_KEY') || '';
const PINECONE_INDEX_NAME = Deno.env.get('PINECONE_INDEX_NAME') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Logger
class Logger {
  info(message: string, data?: any) {
    console.log(`INFO: ${message}`, data ? data : '');
  }
  
  error(message: string, error?: any) {
    console.error(`ERROR: ${message}`, error ? error : '');
  }
}

const logger = new Logger();

// IdealClientService class (simplified version of the Node.js implementation)
class IdealClientService {
  vectorStore: any;
  namespace: string;
  embeddings: any;
  
  constructor() {
    this.vectorStore = null;
    this.namespace = '';
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: OPENAI_API_KEY,
      modelName: "text-embedding-3-large"
    });
  }
  
  setVectorStore(vectorStore: any, namespace: string) {
    this.vectorStore = vectorStore;
    this.namespace = namespace;
  }
  
  validateLabel(label: string) {
    const validLabels = ['ideal', 'less_ideal'];
    if (!validLabels.includes(label.toLowerCase())) {
      throw new Error(`Invalid label: ${label}. Must be one of: ${validLabels.join(', ')}`);
    }
    return label.toLowerCase();
  }
  
  validateType(type: string) {
    const validTypes = ['contacts', 'companies', 'deals'];
    if (!validTypes.includes(type.toLowerCase())) {
      throw new Error(`Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }
    return type.toLowerCase();
  }
  
  async storeIdealClientData(data: any, type: string, label: string) {
    try {
      // Validate inputs
      type = this.validateType(type);
      label = this.validateLabel(label);

      const document = await this.createDocument(data, type, label);
      await this.vectorStore.addDocuments([document], { namespace: this.namespace });

      return {
        stored: true,
        type,
        label,
        id: data.id,
        vectorId: document.metadata.vectorId,
        namespace: this.namespace
      };
    } catch (error) {
      logger.error('Error storing ideal client data:', error);
      throw error;
    }
  }
  
  async createDocument(data: any, type: string, label: string) {
    // Create text content based on type
    const content = type === 'contacts' ? 
      this.createContactContent(data) : 
      type === 'companies' ?
      this.createCompanyContent(data) :
      this.createDealContent(data);

    // Create metadata
    const metadata = {
      type,
      label, // 'ideal' or 'less_ideal'
      source_id: data.id,
      created_at: new Date().toISOString(),
      vectorId: `${type}_${data.id}_${label}`,
      // Type-specific metadata
      ...(this.createTypeSpecificMetadata(data, type))
    };

    return new Document({
      pageContent: content,
      metadata
    });
  }
  
  createTypeSpecificMetadata(data: any, type: string) {
    switch(type) {
      case 'contacts':
        return {
          email_domain: data.properties?.email?.split('@')[1] || '',
          industry: data.enriched?.companies?.[0]?.properties?.industry || '',
          lifecycle_stage: data.properties?.lifecyclestage || '',
          job_title: data.properties?.jobtitle || '',
          has_company: data.enriched?.companies?.length > 0,
          has_deals: data.enriched?.deals?.length > 0,
          deal_count: data.enriched?.deals?.length || 0,
          company_count: data.enriched?.companies?.length || 0,
          related_company_ids: data.enriched?.companies?.map((c: any) => c.id) || [],
          related_deal_ids: data.enriched?.deals?.map((d: any) => d.id) || []
        };
      case 'companies':
        return {
          domain: data.properties?.domain || '',
          industry: data.properties?.industry || '',
          company_type: data.properties?.type || '',
          company_size: data.properties?.numberofemployees || '',
          annual_revenue: data.properties?.annualrevenue || '',
          contact_count: data.enriched?.contacts?.length || 0,
          deal_count: data.enriched?.deals?.length || 0,
          total_revenue: data.enriched?.metrics?.totalRevenue || 0,
          related_contact_ids: data.enriched?.contacts?.map((c: any) => c.id) || [],
          related_deal_ids: data.enriched?.deals?.map((d: any) => d.id) || []
        };
      case 'deals':
        return {
          deal_stage: data.properties?.dealstage || '',
          deal_type: data.properties?.dealtype || '',
          amount: data.properties?.amount || '',
          pipeline: data.properties?.pipeline || '',
          sales_cycle_days: data.enriched?.metrics?.salesCycleDays || '',
          contact_count: data.enriched?.contacts?.length || 0,
          company_count: data.enriched?.companies?.length || 0,
          line_item_count: data.enriched?.lineItems?.length || 0,
          related_contact_ids: data.enriched?.contacts?.map((c: any) => c.id) || [],
          related_company_ids: data.enriched?.companies?.map((c: any) => c.id) || []
        };
      default:
        return {};
    }
  }
  
  createContactContent(contact: any) {
    // Base contact information
    let content = `
    Contact Profile:
    Name: ${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}
    Job Title: ${contact.properties?.jobtitle || 'Unknown'}
    Email: ${contact.properties?.email || 'Unknown'}
    Lifecycle Stage: ${contact.properties?.lifecyclestage || 'Unknown'}
    Lead Status: ${contact.properties?.hs_lead_status || 'Unknown'}
    `.trim();
    
    // Add company information if available
    if (contact.enriched?.companies?.length > 0) {
      const company = contact.enriched.companies[0];
      content += `\n\nCompany Information:
      Company: ${company.properties?.name || 'Unknown'}
      Industry: ${company.properties?.industry || 'Unknown'}
      Size: ${company.properties?.numberofemployees || 'Unknown'} employees
      Revenue: ${company.properties?.annualrevenue || 'Unknown'}
      Type: ${company.properties?.type || 'Unknown'}
      `.trim();
    }
    
    // Add deal information if available
    if (contact.enriched?.deals?.length > 0) {
      content += '\n\nDeal History:';
      contact.enriched.deals.forEach((deal: any, index: number) => {
        content += `
        Deal ${index + 1}:
        Name: ${deal.properties?.dealname || 'Unknown'}
        Stage: ${deal.properties?.dealstage || 'Unknown'}
        Amount: ${deal.properties?.amount || 'Unknown'}
        Type: ${deal.properties?.dealtype || 'Unknown'}
        `.trim();
      });
    }
    
    return content;
  }
  
  createCompanyContent(company: any) {
    // Base company information
    let content = `
    Company Profile:
    Name: ${company.properties?.name || 'Unknown'}
    Industry: ${company.properties?.industry || 'Unknown'}
    Type: ${company.properties?.type || 'Unknown'}
    Size: ${company.properties?.numberofemployees || 'Unknown'} employees
    Revenue: ${company.properties?.annualrevenue || 'Unknown'}
    Location: ${[company.properties?.city, company.properties?.state, company.properties?.country].filter(Boolean).join(', ')}
    Description: ${company.properties?.description || 'No description available'}
    `.trim();
    
    // Add key contacts if available
    if (company.enriched?.contacts?.length > 0) {
      content += '\n\nKey Contacts:';
      company.enriched.contacts.slice(0, 5).forEach((contact: any, index: number) => {
        content += `
        Contact ${index + 1}:
        Name: ${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}
        Title: ${contact.properties?.jobtitle || 'Unknown'}
        Status: ${contact.properties?.hs_lead_status || 'Unknown'}
        `.trim();
      });
    }
    
    // Add deal information if available
    if (company.enriched?.deals?.length > 0) {
      content += '\n\nDeal History:';
      company.enriched.deals.forEach((deal: any, index: number) => {
        content += `
        Deal ${index + 1}:
        Name: ${deal.properties?.dealname || 'Unknown'}
        Stage: ${deal.properties?.dealstage || 'Unknown'}
        Amount: ${deal.properties?.amount || 'Unknown'}
        Type: ${deal.properties?.dealtype || 'Unknown'}
        `.trim();
      });
    }
    
    // Add metrics
    if (company.enriched?.metrics) {
      const metrics = company.enriched.metrics;
      content += `\n\nBusiness Metrics:
      Total Revenue: ${metrics.totalRevenue || 0}
      Total Deals: ${metrics.totalDeals || 0}
      Won Deals: ${metrics.wonDeals || 0}
      Active Contacts: ${metrics.activeContacts || 0}
      `.trim();
    }
    
    return content;
  }
  
  createDealContent(deal: any) {
    // Base deal information
    let content = `
    Deal Profile:
    Name: ${deal.properties?.dealname || 'Unknown'}
    Stage: ${deal.properties?.dealstage || 'Unknown'}
    Amount: ${deal.properties?.amount || 'Unknown'}
    Type: ${deal.properties?.dealtype || 'Unknown'}
    Pipeline: ${deal.properties?.pipeline || 'Unknown'}
    Priority: ${deal.properties?.hs_priority || 'Unknown'}
    Description: ${deal.properties?.description || 'No description available'}
    Created: ${deal.properties?.createdate || 'Unknown'}
    Closed: ${deal.properties?.closedate || 'Not closed'}
    `.trim();
    
    // Add company information if available
    if (deal.enriched?.companies?.length > 0) {
      const company = deal.enriched.companies[0];
      content += `\n\nCompany Information:
      Company: ${company.properties?.name || 'Unknown'}
      Industry: ${company.properties?.industry || 'Unknown'}
      Size: ${company.properties?.numberofemployees || 'Unknown'} employees
      Revenue: ${company.properties?.annualrevenue || 'Unknown'}
      `.trim();
    }
    
    // Add contact information if available
    if (deal.enriched?.contacts?.length > 0) {
      content += '\n\nKey Contacts:';
      deal.enriched.contacts.slice(0, 3).forEach((contact: any, index: number) => {
        content += `
        Contact ${index + 1}:
        Name: ${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}
        Title: ${contact.properties?.jobtitle || 'Unknown'}
        Status: ${contact.properties?.hs_lead_status || 'Unknown'}
        `.trim();
      });
    }
    
    // Add line items if available
    if (deal.enriched?.lineItems?.length > 0) {
      content += '\n\nProducts/Services:';
      deal.enriched.lineItems.forEach((item: any, index: number) => {
        content += `
        Item ${index + 1}:
        Name: ${item.properties?.name || 'Unknown'}
        Quantity: ${item.properties?.quantity || '1'}
        Price: ${item.properties?.price || 'Unknown'}
        Description: ${item.properties?.description || 'No description'}
        `.trim();
      });
    }
    
    // Add metrics
    if (deal.enriched?.metrics) {
      const metrics = deal.enriched.metrics;
      content += `\n\nDeal Metrics:
      Total Value: ${metrics.totalValue || 0}
      Sales Cycle: ${metrics.salesCycleDays || 'Unknown'} days
      Contact Count: ${metrics.contactCount || 0}
      Line Item Count: ${metrics.lineItemCount || 0}
      `.trim();
    }
    
    return content;
  }
  
  async processHubSpotLists(hubspotClient: any, type = 'contacts') {
    try {
      type = this.validateType(type);
      
      // Get data from both lists
      const data = await hubspotClient.getIdealAndLessIdealData(type);
      
      // Process ideal clients
      const idealResults = await Promise.all(
        data.ideal.map((client: any) => 
          this.storeIdealClientData(client, type, 'ideal')
        )
      );

      // Process less-ideal clients
      const lessIdealResults = await Promise.all(
        data.lessIdeal.map((client: any) => 
          this.storeIdealClientData(client, type, 'less_ideal')
        )
      );

      return {
        success: true,
        type,
        summary: {
          ideal: {
            processed: idealResults.length,
            successful: idealResults.filter((r: any) => r.stored).length
          },
          lessIdeal: {
            processed: lessIdealResults.length,
            successful: lessIdealResults.filter((r: any) => r.stored).length
          }
        },
        details: {
          ideal: idealResults,
          lessIdeal: lessIdealResults
        }
      };
    } catch (error) {
      logger.error('Error processing HubSpot lists:', error);
      throw error;
    }
  }
}

// HubSpot client class (simplified version)
class HubspotClient {
  client: any;
  
  constructor(accessToken: string) {
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
  
  async findListByName(listName: string) {
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
  
  async getContactsFromList(listId: string) {
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
            let companies = [];
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
            let deals = [];
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
      return contacts.filter(contact => contact !== null);
    } catch (error) {
      logger.error('Error getting contacts from HubSpot list:', {
        listId,
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  async getCompaniesFromList(listId: string) {
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
            let contacts = [];
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
            let deals = [];
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
      return companies.filter(company => company !== null);
    } catch (error) {
      logger.error('Error getting companies from HubSpot list:', {
        listId,
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  async getDealsFromList(listId: string) {
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
            let contacts = [];
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
            let companies = [];
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
            let lineItems = [];
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
      return deals.filter(deal => deal !== null);
    } catch (error) {
      logger.error('Error getting deals from HubSpot list:', {
        listId,
        error: (error as Error).message
      });
      throw error;
    }
  }
  
  async getIdealAndLessIdealData(type = 'contacts') {
    try {
      // Validate type
      const validTypes = ['contacts', 'companies', 'deals'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`);
      }

      // Get data from both lists
      const data = await this.getContactsFromList(type)
        .then(async (contacts) => {
          const companies = await this.getCompaniesFromList(type);
          const deals = await this.getDealsFromList(type);
          return {
            ideal: contacts.filter((c: any) => c.properties?.hs_lead_status === 'active'),
            lessIdeal: contacts.filter((c: any) => c.properties?.hs_lead_status !== 'active')
          };
        });

      return data;
    } catch (error) {
      logger.error('Error getting ideal and less-ideal data:', error);
      throw error;
    }
  }
} 