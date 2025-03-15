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

export class HubspotClient {
  private accessToken: string;
  private baseUrl = 'https://api.hubspot.com';
  private crmBaseUrl = 'https://api.hubspot.com/crm/v3';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest(path: string, options: RequestInit = {}, useCrmBase = true) {
    const url = `${useCrmBase ? this.crmBaseUrl : this.baseUrl}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('HubSpot API error:', {
        url,
        status: response.status,
        error,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`HubSpot API error: ${error.message || error.status || 'Unknown error'}`);
    }

    return response.json();
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
    return this.makeRequest(`/crm/v3/objects/${type}s/search`, {
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

  async createCrmCard(
    appId: string,
    cardDefinition: {
      title: string;
      properties: string[];
      objectType: 'contacts' | 'companies';
    }
  ) {
    const url = `/crm/v3/extensions/cards/${appId}`;
    console.log('Creating CRM card:', { url, cardDefinition });
    
    try {
      const result = await this.makeRequest(url, {
        method: 'POST',
        body: JSON.stringify({
          title: cardDefinition.title,
          fetch: {
            targetUrl: null,
            objectTypes: [{ name: cardDefinition.objectType }]
          },
          display: {
            properties: cardDefinition.properties.map(prop => ({
              name: prop,
              label: null,
              dataType: 'STRING',
              options: []
            }))
          },
          actions: []
        }),
      }, false);
      console.log('CRM card created:', result);
      return result;
    } catch (error) {
      console.error('Failed to create CRM card:', {
        error,
        objectType: cardDefinition.objectType
      });
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
} 