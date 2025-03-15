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
  private baseUrl = 'https://api.hubspot.com/crm/v3';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest(path: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${path}`;
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
    return this.makeRequest(`/properties/${objectType}/groups`, {
      method: 'POST',
      body: JSON.stringify({
        name: group.name,
        label: group.label,
        displayOrder: group.displayOrder,
      }),
    });
  }

  async createContactProperty(property: Property) {
    return this.makeRequest('/properties/contacts', {
      method: 'POST',
      body: JSON.stringify(property),
    });
  }

  async createCompanyProperty(property: Property) {
    return this.makeRequest('/properties/companies', {
      method: 'POST',
      body: JSON.stringify(property),
    });
  }

  async createDealProperty(property: Property) {
    return this.makeRequest('/properties/deals', {
      method: 'POST',
      body: JSON.stringify(property),
    });
  }

  async createWebhookSubscription(
    portalId: string,
    appId: string,
    subscription: { eventType: string; webhookUrl: string }
  ) {
    return this.makeRequest(`/webhooks/app/subscriptions`, {
      method: 'POST',
      body: JSON.stringify({
        ...subscription,
        active: true,
        appId,
        portalId,
      }),
    });
  }
} 