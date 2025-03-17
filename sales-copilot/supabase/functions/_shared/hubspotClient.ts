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

export class HubspotClient {
  private accessToken: string;
  private baseUrl = 'https://api.hubapi.com';
  private crmBaseUrl = 'https://api.hubspot.com/crm/v3';
  private rateLimitDelay = 100; // ms between requests
  private maxRetries = 3;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
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

  private async makeRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    return this.rateLimitedRequest(async () => {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`HubSpot API error: ${response.status} ${response.statusText} ${JSON.stringify(error)}`);
      }

      return response.json();
    });
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

  async searchRecords(type: 'contact' | 'company' | 'deal', request: SearchRequest) {
    return this.makeRequest(`/objects/${type}s/search`, {
      method: 'POST',
      body: JSON.stringify(request)
    });
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
    }
  ) {
    const url = `/webhooks/v3/${appId}/subscriptions`;
    
    return this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        eventType: subscriptionDetails.eventType,
        propertyName: subscriptionDetails.propertyName,
        webhookUrl: subscriptionDetails.webhookUrl,
        active: true
      })
    }, false);
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

    // Validate property groups
    for (const target of ['contact', 'company', 'deal'] as const) {
      try {
        await this.makeRequest(`/properties/v2/${target}s/groups`, {
          method: 'POST',
          body: JSON.stringify({ ...propertyGroup, target })
        });
      } catch (error) {
        if (!error.message.includes('already exists')) throw error;
      }
    }

    // Validate properties for each object type
    for (const target of ['contact', 'company', 'deal'] as const) {
      for (const property of properties) {
        try {
          await this.makeRequest(`/properties/v2/${target}s/properties`, {
            method: 'POST',
            body: JSON.stringify(property)
          });
        } catch (error) {
          if (!error.message.includes('already exists')) throw error;
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
} 