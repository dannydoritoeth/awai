import { Logger } from '../utils/logger.ts';

export interface HubspotRecord {
  id: string;
  properties: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
}

interface SearchRequest {
  filterGroups: Array<{
    filters: Array<{
      propertyName: string;
      operator: string;
      value: string;
    }>;
  }>;
  limit: number;
  after?: string;
}

interface SearchResponse<T> {
  results: T[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

export class HubspotClient {
  private baseUrl = 'https://api.hubapi.com';
  private accessToken: string;
  private logger: Logger;

  constructor(accessToken: string, logger?: Logger) {
    this.accessToken = accessToken;
    this.logger = logger || new Logger('hubspot-client');
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`HubSpot API error: ${JSON.stringify(error)}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`HubSpot API request failed: ${url}`, error);
      throw error;
    }
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
} 