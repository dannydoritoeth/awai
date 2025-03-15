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

interface Property {
  name: string;
  label: string;
  type: string;
  groupName: string;
  fieldType: string;
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
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`HubSpot API error: ${error.message}`);
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
    const objectType = group.target + 's'; // contacts, companies, deals
    return this.makeRequest(`/properties/v2/${objectType}/groups`, {
      method: 'POST',
      body: JSON.stringify({
        name: group.name,
        label: group.label,
        displayOrder: group.displayOrder,
      }),
    }, false);
  }

  async createContactProperty(property: Property) {
    return this.makeRequest('/properties/v2/contacts/properties', {
      method: 'POST',
      body: JSON.stringify(property),
    }, false);
  }

  async createCompanyProperty(property: Property) {
    return this.makeRequest('/properties/v2/companies/properties', {
      method: 'POST',
      body: JSON.stringify(property),
    }, false);
  }

  async createDealProperty(property: Property) {
    return this.makeRequest('/properties/v2/deals/properties', {
      method: 'POST',
      body: JSON.stringify(property),
    }, false);
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
        subscriptionDetails: {
          propertyName: subscriptionDetails.propertyName,
          eventType: subscriptionDetails.eventType
        },
        throttling: {
          maxConcurrentRequests: 10
        },
        webhookUrl: subscriptionDetails.webhookUrl,
        enabled: true
      })
    }, false);
  }
} 