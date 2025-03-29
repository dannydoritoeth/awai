import { Logger } from './logger.ts';
import { HubspotClientInterface, PropertyHistoryEntry, EngagementHistoryEntry } from './types.ts';

export interface HubspotRecord {
  id: string;
  properties: Record<string, any>;
}

export interface HubSpotWebhookEvent {
  subscriptionType: string;
  portalId: number;
  objectId: number;
  propertyName?: string;
  propertyValue?: string;
  changeSource?: string;
  eventId?: string;
  appId?: number;
}

interface PropertyGroup {
  name: string;
  label: string;
  displayOrder: number;
  target: 'contact' | 'company' | 'deal';
}

interface PropertyOption {
  label: string;
  value: string;
  description?: string;
  hidden?: boolean;
}

interface Property {
  name: string;
  label: string;
  type: string;
  groupName: string;
  fieldType: string;
  description?: string;
  options?: PropertyOption[];
}

interface SearchResponse<T> {
  total: number;
  results: T[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

interface SearchFilter {
  propertyName: string;
  operator: string;
  value?: string;
  values?: string[];
}

interface SearchRequest {
  filterGroups: Array<{
    filters: SearchFilter[];
  }>;
  properties?: string[];
  limit?: number;
  after?: string;
}

interface CrmCardProperty {
  name: string;
  label: string;
  dataType: string;
  options?: any[];
}

interface CrmCardDefinition {
  title: string;
  fetch?: {
    targetUrl: string;
    objectTypes: string[];
    headers?: Record<string, string>;
  };
  display: {
    properties: CrmCardProperty[];
  };
  actions?: Record<string, any>;
}

export class HubspotClient implements HubspotClientInterface {
  private accessToken: string;
  private logger: Logger;
  private baseUrl = 'https://api.hubapi.com';
  private crmBaseUrl = 'https://api.hubspot.com/crm/v3';
  private rateLimitDelay = 100; // ms between requests
  private maxRetries = 3;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.logger = new Logger('HubspotClient');
  }

  private async rateLimitedRequest<T>(fn: () => Promise<T>, retryCount = 0): Promise<T> {
    try {
      const result = await fn();
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      return result;
    } catch (error) {
      if (error.status === 429 && retryCount < this.maxRetries) { // Too Many Requests
        // Wait for the time specified in the response headers or default to 10 seconds
        const retryAfter = (error.headers?.get('Retry-After') || 10) * 1000;
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        return this.rateLimitedRequest(fn, retryCount + 1);
      }
      throw error;
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    // If the endpoint starts with http(s), use it as is, otherwise prepend baseUrl
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `Request failed: ${response.statusText}`);
    }

    return response;
  }

  async getContact(id: string): Promise<HubspotRecord> {
    return this.makeRequest(`/objects/contacts/${id}`);
  }

  async getCompany(id: string): Promise<HubspotRecord> {
    return this.makeRequest(`/objects/companies/${id}`);
  }

  async getDeal(id: string): Promise<HubspotRecord> {
    return this.makeRequest(`/objects/deals/${id}`);
  }

  async updateContact(id: string, properties: Record<string, any>): Promise<HubspotRecord> {
    return this.makeRequest(`/objects/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
  }

  async updateCompany(id: string, properties: Record<string, any>): Promise<HubspotRecord> {
    return this.makeRequest(`/objects/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
  }

  async updateDeal(id: string, properties: Record<string, any>): Promise<HubspotRecord> {
    return this.makeRequest(`/objects/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
  }

  async searchContacts(request: SearchRequest): Promise<SearchResponse<HubspotRecord>> {
    return this.makeRequest('/objects/contacts/search', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async searchCompanies(request: SearchRequest): Promise<SearchResponse<HubspotRecord>> {
    return this.makeRequest('/objects/companies/search', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async searchDeals(request: SearchRequest): Promise<SearchResponse<HubspotRecord>> {
    return this.makeRequest('/objects/deals/search', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async searchRecords(objectType: string, query: any): Promise<any> {
    try {
      const endpoint = `https://api.hubapi.com/crm/v3/objects/${objectType}/search`;
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        throw new Error(`Failed to search records: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      this.logger.error('Error searching records:', error);
      throw error;
    }
  }

  async createPropertyGroup(group: PropertyGroup) {
    const objectTypePlural = {
      'contact': 'contacts',
      'company': 'companies',
      'deal': 'deals'
    }[group.target];

    const url = `/properties/v1/${objectTypePlural}/groups`;
    console.log('Creating property group:', { url, group });
    
    try {
      const result = await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          name: group.name,
          displayName: group.label,
          displayOrder: group.displayOrder
        }),
      }, false);
      console.log('Property group created:', result);
      return result;
    } catch (error) {
      console.error('Failed to create property group:', {
        error,
        objectType: objectTypePlural,
        groupName: group.name
      });
      throw error;
    }
  }

  async createContactProperty(property: Property) {
    const url = '/properties/v1/contacts/properties';
    console.log('Creating contact property:', { url, property });
    
    try {
      const result = await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          name: property.name,
          label: property.label,
          description: property.description,
          groupName: property.groupName,
          type: property.type,
          fieldType: property.fieldType,
          options: property.options?.map(opt => ({
            label: opt.label,
            value: opt.value,
            description: opt.description,
            hidden: opt.hidden
          })) || []
        }),
      }, false);
      console.log('Contact property created:', result);
      return result;
    } catch (error) {
      console.error('Failed to create contact property:', {
        error,
        propertyName: property.name,
        groupName: property.groupName
      });
      throw error;
    }
  }

  async createCompanyProperty(property: Property) {
    const url = '/properties/v1/companies/properties';
    console.log('Creating company property:', { url, property });
    
    try {
      const result = await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          name: property.name,
          label: property.label,
          description: property.description,
          groupName: property.groupName,
          type: property.type,
          fieldType: property.fieldType,
          options: property.options?.map(opt => ({
            label: opt.label,
            value: opt.value,
            description: opt.description,
            hidden: opt.hidden
          })) || []
        }),
      }, false);
      console.log('Company property created:', result);
      return result;
    } catch (error) {
      console.error('Failed to create company property:', {
        error,
        propertyName: property.name,
        groupName: property.groupName
      });
      throw error;
    }
  }

  async createDealProperty(property: Property) {
    return this.makeRequest('/properties/v2/deals/properties', {
      method: 'POST',
      body: JSON.stringify(property),
    }, false);
  }

  async createCrmCard(appId: string, cardDefinition: CrmCardDefinition, isPublicApp = false) {
    const url = isPublicApp 
      ? `/crm/v3/extensions/cards/public-apps/${appId}`
      : `/crm/v3/extensions/cards/${appId}`;
    
    console.log('Creating CRM card:', { url, cardDefinition });
    
    try {
      const result = await fetch(`${this.baseUrl}${url}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cardDefinition)
      });

      if (!result.ok) {
        const error = await result.json().catch(() => ({ message: 'Unknown error' }));
        console.error('HubSpot API error:', {
          url,
          status: result.status,
          error,
          headers: Object.fromEntries(result.headers.entries())
        });
        throw new Error(`HubSpot API error: ${error.message || error.status || 'Unknown error'}`);
      }

      const data = await result.json();
      console.log('CRM card created:', data);
      return data;
    } catch (error) {
      console.error('Failed to create CRM card:', error);
      throw error;
    }
  }

  async createWebhookSubscription(
    appId: string,
    subscriptionDetails: {
      eventType: string;
      webhookUrl: string;
      propertyName?: string;
      objectType?: string;
    }
  ) {
    const url = `/webhooks/v3/${appId}/subscriptions`;
    
    const subscription = {
      eventType: subscriptionDetails.eventType,
      propertyName: subscriptionDetails.propertyName,
      objectType: subscriptionDetails.objectType,
      webhookUrl: subscriptionDetails.webhookUrl,
      active: true
    };

    this.logger.info('Creating webhook subscription:', subscription);
    
    return this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(subscription)
    });
  }

  /**
   * Set up training field webhooks for a specific object type
   */
  async setupTrainingWebhooks(
    appId: string,
    objectType: 'contacts' | 'companies' | 'deals',
    webhookUrl: string
  ) {
    const trainingProperties = [
      'training_score',
      'training_attributes',
      'training_notes'
    ];

    const subscriptions = [];

    for (const propertyName of trainingProperties) {
      try {
        const subscription = await this.createWebhookSubscription(appId, {
          eventType: 'property.propertyChange',
          propertyName,
          objectType,
          webhookUrl
        });
        subscriptions.push(subscription);
        this.logger.info(`Created webhook for ${objectType}.${propertyName}`);
      } catch (error) {
        this.logger.error(`Failed to create webhook for ${objectType}.${propertyName}:`, error);
        throw error;
      }
    }

    return subscriptions;
  }

  /**
   * Set up all training webhooks for contacts, companies, and deals
   */
  async setupAllTrainingWebhooks(appId: string, webhookUrl: string) {
    const objectTypes = ['contacts', 'companies', 'deals'] as const;
    const results = {};

    for (const objectType of objectTypes) {
      try {
        results[objectType] = await this.setupTrainingWebhooks(appId, objectType, webhookUrl);
        this.logger.info(`Successfully set up webhooks for ${objectType}`);
      } catch (error) {
        this.logger.error(`Failed to set up webhooks for ${objectType}:`, error);
        throw error;
      }
    }

    return results;
  }

  async getContactWithProperties(id: string, properties: string[]): Promise<HubspotRecord> {
    return this.makeRequest(`/objects/contacts/${id}?properties=${properties.join(',')}`);
  }

  async getCompanyWithProperties(id: string, properties: string[]): Promise<HubspotRecord> {
    return this.makeRequest(`/objects/companies/${id}?properties=${properties.join(',')}`);
  }

  async getDealWithProperties(id: string, properties: string[]): Promise<HubspotRecord> {
    return this.makeRequest(`/objects/deals/${id}?properties=${properties.join(',')}`);
  }

  async createScoringProperties() {
    const propertyGroup = {
      name: 'ideal_client_fit',
      label: 'Ideal Client Fit',
      displayOrder: 1
    };

    // Create property group for each object type
    await this.createPropertyGroup({ ...propertyGroup, target: 'contact' });
    await this.createPropertyGroup({ ...propertyGroup, target: 'company' });
    await this.createPropertyGroup({ ...propertyGroup, target: 'deal' });

    // Define the properties
    const properties = [
      {
        name: 'ideal_client_score',
        label: 'Ideal Client Score',
        type: 'number',
        fieldType: 'number',
        groupName: 'ideal_client_fit',
        description: 'AI-generated score indicating how well this record matches the ideal client profile'
      },
      {
        name: 'ideal_client_summary',
        label: 'Ideal Client Summary',
        type: 'string',
        fieldType: 'textarea',
        groupName: 'ideal_client_fit',
        description: 'AI-generated summary explaining the ideal client fit score'
      },
      {
        name: 'ideal_client_last_scored',
        label: 'Last Scored At',
        type: 'datetime',
        fieldType: 'date',
        groupName: 'ideal_client_fit',
        description: 'When this record was last scored by the AI'
      }
    ];

    // Create properties for contacts
    for (const property of properties) {
      await this.createContactProperty(property);
    }

    // Create properties for companies
    for (const property of properties) {
      await this.createCompanyProperty(property);
    }

    // Create properties for deals
    for (const property of properties) {
      await this.createDealProperty(property);
    }
  }

  async validateProperties(): Promise<void> {
    const propertyGroup = {
      name: 'ideal_client_fit',
      label: 'Ideal Client Fit',
      displayOrder: 1
    };

    const properties = [
      {
        name: 'ideal_client_score',
        label: 'Ideal Client Score',
        type: 'number',
        fieldType: 'number',
        groupName: 'ideal_client_fit',
        description: 'AI-generated score indicating how well this record matches the ideal client profile'
      },
      {
        name: 'ideal_client_summary',
        label: 'Ideal Client Summary',
        type: 'string',
        fieldType: 'textarea',
        groupName: 'ideal_client_fit',
        description: 'AI-generated summary explaining the ideal client fit score'
      },
      {
        name: 'ideal_client_last_scored',
        label: 'Last Scored At',
        type: 'datetime',
        fieldType: 'date',
        groupName: 'ideal_client_fit',
        description: 'When this record was last scored by the AI'
      }
    ];

    const objectTypePlural = {
      'contact': 'contacts',
      'company': 'companies',
      'deal': 'deals'
    };

    // Validate property groups
    for (const target of ['contact', 'company', 'deal'] as const) {
      try {
        await this.makeRequest(`/properties/v2/${objectTypePlural[target]}/groups`, {
          method: 'POST',
          body: JSON.stringify({
            name: propertyGroup.name,
            displayName: propertyGroup.label,
            displayOrder: propertyGroup.displayOrder
          })
        });
      } catch (error) {
        if (!error.message?.includes('already exists')) {
          this.logger.error(`Failed to create property group for ${target}:`, error);
          throw error;
        }
      }
    }

    // Validate properties for each object type
    for (const target of ['contact', 'company', 'deal'] as const) {
      for (const property of properties) {
        try {
          await this.makeRequest(`/properties/v2/${objectTypePlural[target]}/properties`, {
            method: 'POST',
            body: JSON.stringify(property)
          });
        } catch (error) {
          if (!error.message?.includes('already exists')) {
            this.logger.error(`Failed to create property for ${target}:`, error);
            throw error;
          }
        }
      }
    }
  }

  // Update existing methods to use rate-limited requests
  async getContact(contactId: string): Promise<any> {
    return this.makeRequest(`/crm/v3/objects/contacts/${contactId}`);
  }

  async updateContact(contactId: string, properties: Record<string, any>): Promise<any> {
    return this.makeRequest(`/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }

  async getCompany(companyId: string): Promise<any> {
    return this.makeRequest(`/crm/v3/objects/companies/${companyId}`);
  }

  async updateCompany(companyId: string, properties: Record<string, any>): Promise<any> {
    return this.makeRequest(`/crm/v3/objects/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }

  async getDeal(dealId: string): Promise<any> {
    return this.makeRequest(`/crm/v3/objects/deals/${dealId}`);
  }

  async updateDeal(dealId: string, properties: Record<string, any>): Promise<any> {
    return this.makeRequest(`/crm/v3/objects/deals/${dealId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties })
    });
  }

  /**
   * Get the history of property changes for a record
   */
  async getPropertyHistory(recordId: string, recordType: string, properties: string[]): Promise<PropertyHistoryEntry[]> {
    try {
      const endpoint = `https://api.hubapi.com/crm/v3/objects/${recordType}/${recordId}/history`;
      const params = new URLSearchParams({ properties: properties.join(',') });
      const response = await this.makeRequest(`${endpoint}?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to get property history: ${response.statusText}`);
      }

      const data = await response.json();
      return data.results.map((change: any) => ({
        timestamp: change.timestamp,
        propertyName: change.propertyName,
        previousValue: change.previousValue,
        value: change.value,
        source: change.sourceType || 'system'
      }));
    } catch (error) {
      this.logger.error('Error getting property history:', error);
      return [];
    }
  }

  /**
   * Get the engagement history for a record
   */
  async getEngagementHistory(recordId: string, recordType: string): Promise<EngagementHistoryEntry[]> {
    try {
      const endpoint = `https://api.hubapi.com/crm/v3/objects/${recordType}/${recordId}/associations/engagement`;
      const response = await this.makeRequest(endpoint);

      if (!response.ok) {
        throw new Error(`Failed to get engagements: ${response.statusText}`);
      }

      const data = await response.json();
      const engagementIds = data.results.map((result: any) => result.id);

      const engagements = await Promise.all(
        engagementIds.map(async (id: string) => {
          const engagementResponse = await this.makeRequest(
            `https://api.hubapi.com/engagements/v1/engagements/${id}`
          );

          if (!engagementResponse.ok) {
            return null;
          }

          const engagementData = await engagementResponse.json();
          return {
            type: this.mapEngagementType(engagementData.engagement.type),
            timestamp: engagementData.engagement.createdAt,
            details: this.formatEngagementDetails(engagementData)
          };
        })
      );

      return engagements.filter((e): e is NonNullable<typeof e> => e !== null);
    } catch (error) {
      this.logger.error('Error getting engagement history:', error);
      return [];
    }
  }

  /**
   * Map HubSpot engagement types to our standardized types
   */
  private mapEngagementType(type: string): string {
    const typeMap: Record<string, string> = {
      'NOTE': 'note',
      'EMAIL': 'email',
      'TASK': 'task',
      'CALL': 'call',
      'MEETING': 'meeting',
      'FORM_SUBMISSION': 'form_submission',
      'PAGE_VIEW': 'page_view',
      'DOCUMENT_DOWNLOAD': 'downloaded_content',
      'WEBINAR_REGISTRATION': 'attended_webinar',
      'DEMO_REQUEST': 'requested_demo',
      'PRICING_PAGE_VIEW': 'visited_pricing'
    };

    return typeMap[type] || type.toLowerCase();
  }

  /**
   * Format engagement details into a readable string
   */
  private formatEngagementDetails(engagement: any): string {
    const type = engagement.engagement.type;
    const metadata = engagement.metadata;

    switch (type) {
      case 'EMAIL':
        return `Email: ${metadata.subject || 'No subject'}`;
      case 'CALL':
        return `Call: ${metadata.status || 'Unknown status'} - ${metadata.disposition || 'No disposition'}`;
      case 'MEETING':
        return `Meeting: ${metadata.title || 'No title'}`;
      case 'FORM_SUBMISSION':
        return `Form submitted: ${metadata.formName || 'Unknown form'}`;
      case 'PAGE_VIEW':
        return `Viewed page: ${metadata.path || 'Unknown page'}`;
      case 'DOCUMENT_DOWNLOAD':
        return `Downloaded: ${metadata.documentName || 'Unknown document'}`;
      case 'NOTE':
        return metadata.body || 'No content';
      default:
        return `${type}: ${JSON.stringify(metadata)}`;
    }
  }

  /**
   * Get a single record by ID
   */
  async getRecord(objectType: string, recordId: string, properties: string[]): Promise<any> {
    try {
      const endpoint = `https://api.hubapi.com/crm/v3/objects/${objectType}/${recordId}`;
      const params = new URLSearchParams({ properties: properties.join(',') });
      const response = await this.makeRequest(`${endpoint}?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to get record: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      this.logger.error('Error getting record:', error);
      throw error;
    }
  }
} 