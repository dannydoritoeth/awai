import { Logger } from './logger.ts';
import { HubspotClientInterface, PropertyHistoryEntry, EngagementHistoryEntry } from './types.ts';

export interface HubspotRecord {
  id: string;
  properties: Record<string, any>;
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

  updateToken(newAccessToken: string) {
    this.accessToken = newAccessToken;
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

  async searchRecords(objectType: string, query: any): Promise<SearchResponse<HubspotRecord>> {
    try {
      const endpoint = `/crm/v3/objects/${objectType}/search`;
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(query)
      });
      const data = await response.json();
      return {
        total: data.total,
        results: data.results,
        paging: data.paging
      };
    } catch (error) {
      this.logger.error(`Error searching ${objectType}:`, {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        query
      });
      throw error;
    }
  }

  async createPropertyGroup(group: PropertyGroup) {
    const objectTypePlural = {
      'contact': 'contacts',
      'company': 'companies',
      'deal': 'deals'
    }[group.target];

    const endpoint = `/properties/v1/${objectTypePlural}/groups`;
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        name: group.name,
        displayName: group.label,
        displayOrder: group.displayOrder
      })
    });
  }

  async createContactProperty(property: Property) {
    const endpoint = '/properties/v1/contacts/properties';
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(property)
    });
  }

  async createCompanyProperty(property: Property) {
    const endpoint = '/properties/v1/companies/properties';
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(property)
    });
  }

  async createDealProperty(property: Property) {
    const endpoint = '/properties/v1/deals/properties';
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(property)
    });
  }

  async createCrmCard(appId: string, cardDefinition: CrmCardDefinition, isPublicApp = false) {
    const endpoint = isPublicApp ? 
      `/crm/v3/extensions/cards/${appId}` : 
      `/crm/v3/extensions/cards/${appId}/associations`;
    
    return this.makeRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(cardDefinition)
    });
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
    // Create property group
    await this.createPropertyGroup({
      name: 'ai_scoring',
      label: 'AI Scoring',
      displayOrder: 1,
      target: 'contact'
    });

    // Create contact properties
    await this.createContactProperty({
      name: 'ideal_client_score',
      label: 'Ideal Client Score',
      type: 'number',
      fieldType: 'number',
      description: 'AI-generated score indicating how well this contact matches your ideal client profile',
      groupName: 'ai_scoring'
    });

    await this.createContactProperty({
      name: 'ideal_client_summary',
      label: 'Ideal Client Summary',
      type: 'string',
      fieldType: 'textarea',
      description: 'AI-generated analysis of why this contact matches or differs from your ideal client profile',
      groupName: 'ai_scoring'
    });

    await this.createContactProperty({
      name: 'ideal_client_last_scored',
      label: 'Last Scored',
      type: 'datetime',
      fieldType: 'date',
      description: 'When this contact was last analyzed by AI',
      groupName: 'ai_scoring'
    });

    // Create company properties
    await this.createCompanyProperty({
      name: 'ideal_client_score',
      label: 'Ideal Client Score',
      type: 'number',
      fieldType: 'number',
      description: 'AI-generated score indicating how well this company matches your ideal client profile',
      groupName: 'ai_scoring'
    });

    await this.createCompanyProperty({
      name: 'ideal_client_summary',
      label: 'Ideal Client Summary',
      type: 'string',
      fieldType: 'textarea',
      description: 'AI-generated analysis of why this company matches or differs from your ideal client profile',
      groupName: 'ai_scoring'
    });

    await this.createCompanyProperty({
      name: 'ideal_client_last_scored',
      label: 'Last Scored',
      type: 'datetime',
      fieldType: 'date',
      description: 'When this company was last analyzed by AI',
      groupName: 'ai_scoring'
    });

    // Create deal properties
    await this.createDealProperty({
      name: 'ideal_client_score',
      label: 'Ideal Client Score',
      type: 'number',
      fieldType: 'number',
      description: 'AI-generated score indicating how well this deal matches your ideal client profile',
      groupName: 'ai_scoring'
    });

    await this.createDealProperty({
      name: 'ideal_client_summary',
      label: 'Ideal Client Summary',
      type: 'string',
      fieldType: 'textarea',
      description: 'AI-generated analysis of why this deal matches or differs from your ideal client profile',
      groupName: 'ai_scoring'
    });

    await this.createDealProperty({
      name: 'ideal_client_last_scored',
      label: 'Last Scored',
      type: 'datetime',
      fieldType: 'date',
      description: 'When this deal was last analyzed by AI',
      groupName: 'ai_scoring'
    });
  }

  async validateProperties(): Promise<void> {
    const requiredProperties = {
      contacts: ['ideal_client_score', 'ideal_client_summary', 'ideal_client_last_scored'],
      companies: ['ideal_client_score', 'ideal_client_summary', 'ideal_client_last_scored'],
      deals: ['ideal_client_score', 'ideal_client_summary', 'ideal_client_last_scored']
    };

    for (const [objectType, properties] of Object.entries(requiredProperties)) {
      for (const property of properties) {
        try {
          await this.makeRequest(`/crm/v3/properties/${objectType}/${property}`);
        } catch (error) {
          this.logger.error(`Property ${property} not found for ${objectType}`);
          throw new Error(`Required property ${property} not found for ${objectType}`);
        }
      }
    }
  }

  async getPropertyHistory(recordId: string, recordType: string, properties: string[]): Promise<PropertyHistoryEntry[]> {
    const endpoint = `/crm/v3/objects/${recordType}/${recordId}/associations/properties`;
    const response = await this.makeRequest(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return data.results.map((entry: any) => ({
      propertyName: entry.propertyName,
      value: entry.value,
      source: entry.source,
      sourceId: entry.sourceId,
      timestamp: entry.timestamp
    }));
  }

  async getEngagementHistory(recordId: string, recordType: string): Promise<EngagementHistoryEntry[]> {
    const endpoint = `/crm/v3/objects/${recordType}/${recordId}/associations/engagements`;
    const response = await this.makeRequest(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return data.results.map((engagement: any) => ({
      id: engagement.id,
      type: this.mapEngagementType(engagement.type),
      timestamp: engagement.timestamp,
      details: this.formatEngagementDetails(engagement)
    }));
  }

  private mapEngagementType(type: string): string {
    const typeMap: Record<string, string> = {
      'EMAIL': 'Email',
      'CALL': 'Call',
      'MEETING': 'Meeting',
      'NOTE': 'Note',
      'TASK': 'Task',
      'SMS': 'SMS',
      'CHAT': 'Chat',
      'GOAL': 'Goal',
      'ACTIVITY': 'Activity'
    };
    return typeMap[type] || type;
  }

  private formatEngagementDetails(engagement: any): string {
    let details = '';
    
    switch (engagement.type) {
      case 'EMAIL':
        details = `Subject: ${engagement.metadata.subject || 'No subject'}`;
        break;
      case 'CALL':
        details = `Duration: ${engagement.metadata.duration || 'Unknown'}`;
        break;
      case 'MEETING':
        details = `Title: ${engagement.metadata.title || 'No title'}`;
        break;
      case 'NOTE':
        details = engagement.metadata.body || 'No content';
        break;
      case 'TASK':
        details = `Task: ${engagement.metadata.task || 'No task'}`;
        break;
      case 'SMS':
        details = `Message: ${engagement.metadata.body || 'No message'}`;
        break;
      case 'CHAT':
        details = `Chat: ${engagement.metadata.body || 'No chat'}`;
        break;
      case 'GOAL':
        details = `Goal: ${engagement.metadata.goal || 'No goal'}`;
        break;
      case 'ACTIVITY':
        details = `Activity: ${engagement.metadata.activity || 'No activity'}`;
        break;
      default:
        details = 'Unknown engagement type';
    }

    return details;
  }

  async getRecord(objectType: string, recordId: string, properties: string[]): Promise<any> {
    const endpoint = `/crm/v3/objects/${objectType}/${recordId}?properties=${properties.join(',')}`;
    const response = await this.makeRequest(endpoint);
    return response.json();
  }
} 