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

interface CustomError extends Error {
  status?: number;
  headers?: Headers;
}

export class HubspotClient implements HubspotClientInterface {
  private accessToken: string;
  private logger: Logger;
  private baseUrl = 'https://api.hubapi.com';
  private crmBaseUrl = 'https://api.hubspot.com/crm/v3';
  private rateLimitDelay = 500; // Increased from 250ms to 500ms between requests
  private maxRetries = 5;
  private baseRetryDelay = 2000; // Increased base delay to 2 seconds
  private maxRetryDelay = 32000; // Maximum retry delay of 32 seconds

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.logger = new Logger('HubspotClient');
  }

  updateToken(newAccessToken: string) {
    this.accessToken = newAccessToken;
  }

  /**
   * Alias for updateToken
   */
  setToken(newAccessToken: string) {
    this.updateToken(newAccessToken);
  }

  /**
   * Refreshes the HubSpot OAuth token
   */
  async refreshToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    this.logger.info('Refreshing HubSpot token...');
    
    try {
      const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error('Failed to refresh token:', errorText);
        const error = new Error(`Failed to refresh HubSpot token: ${errorText}`);
        throw error;
      }

      const result = await response.json();
      this.logger.info('Successfully refreshed HubSpot token');
      return result;
    } catch (error) {
      this.logger.error('Error in refreshToken:', error);
      throw error;
    }
  }

  // Add jitter helper function
  private getJitter(base: number): number {
    // Add random jitter of ±25% to the base delay
    const jitterFactor = 0.75 + Math.random() * 0.5; // Random number between 0.75 and 1.25
    return Math.floor(base * jitterFactor);
  }

  private async rateLimitedRequest<T>(fn: () => Promise<T>, retryCount = 0): Promise<T> {
    try {
      // Add initial delay with jitter before the request
      const initialDelay = this.getJitter(this.rateLimitDelay);
      await new Promise(resolve => setTimeout(resolve, initialDelay));

      const result = await fn();
      return result;
    } catch (error) {
      const customError = error as CustomError;
      
      if (customError.status === 429 && retryCount < this.maxRetries) {
        // Calculate exponential backoff delay with jitter
        const retryAfter = customError.headers?.get('Retry-After');
        let backoffDelay: number;
        
        if (retryAfter) {
          // Use the server's retry-after value with jitter
          backoffDelay = this.getJitter(parseInt(retryAfter, 10) * 1000);
        } else {
          // Calculate exponential backoff with jitter
          const baseDelay = Math.min(
            this.baseRetryDelay * Math.pow(2, retryCount),
            this.maxRetryDelay
          );
          backoffDelay = this.getJitter(baseDelay);
        }

        this.logger.info(`Rate limited. Retrying in ${backoffDelay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        return this.rateLimitedRequest(fn, retryCount + 1);
      }
      
      if (customError.status === 429) {
        this.logger.error('Rate limit exceeded and max retries reached');
        throw new Error('HubSpot rate limit exceeded. Please try again later.');
      }
      throw error;
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    return this.rateLimitedRequest(async () => {
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
        const customError: CustomError = new Error();
        customError.status = response.status;
        customError.headers = response.headers;
        
        try {
          const errorData = await response.json();
          customError.message = errorData.message || `Request failed: ${response.statusText}`;
        } catch {
          customError.message = `Request failed: ${response.statusText}`;
        }
        
        throw customError;
      }

      return response;
    });
  }

  private async makeJsonRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await this.makeRequest(endpoint, options);
    return response.json();
  }

  async getContact(id: string, properties: string[] = []): Promise<HubspotRecord> {
    return this.getRecord('contacts', id, properties) as Promise<HubspotRecord>;
  }

  async getCompany(id: string, properties: string[] = []): Promise<HubspotRecord> {
    return this.getRecord('companies', id, properties) as Promise<HubspotRecord>;
  }

  async getDeal(id: string, properties: string[] = []): Promise<HubspotRecord> {
    return this.getRecord('deals', id, properties) as Promise<HubspotRecord>;
  }

  async updateContact(id: string, properties: Record<string, any>): Promise<HubspotRecord> {
    const response = await this.makeRequest(`${this.crmBaseUrl}/objects/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
    return response.json();
  }

  async updateCompany(id: string, properties: Record<string, any>): Promise<HubspotRecord> {
    const response = await this.makeRequest(`${this.crmBaseUrl}/objects/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
    return response.json();
  }

  async updateDeal(id: string, properties: Record<string, any>): Promise<HubspotRecord> {
    const response = await this.makeRequest(`${this.crmBaseUrl}/objects/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    });
    return response.json();
  }

  /**
   * @deprecated Use searchRecords('contacts', request) instead
   */
  async searchContacts(request: SearchRequest): Promise<SearchResponse<HubspotRecord>> {
    return this.searchRecords('contacts', request);
  }

  /**
   * @deprecated Use searchRecords('companies', request) instead
   */
  async searchCompanies(request: SearchRequest): Promise<SearchResponse<HubspotRecord>> {
    return this.searchRecords('companies', request);
  }

  /**
   * @deprecated Use searchRecords('deals', request) instead
   */
  async searchDeals(request: SearchRequest): Promise<SearchResponse<HubspotRecord>> {
    return this.searchRecords('deals', request);
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

  async getRecord(objectType: string, recordId: string, properties: string[] = []): Promise<HubspotRecord> {
    try {
      const propertiesParam = properties.length > 0 ? `?properties=${properties.join(',')}` : '';
      const endpoint = `${this.crmBaseUrl}/objects/${objectType}/${recordId}${propertiesParam}`;
      const response = await this.makeJsonRequest<HubspotRecord>(endpoint);
      return response;
    } catch (error) {
      this.logger.error(`Error getting ${objectType} record ${recordId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get all associations for a specific object ID using Associations V3 API
   * @param objectId The ID of the object to get associations for
   * @param objectType The type of object (deal, contact, company)
   * @returns Object containing associations grouped by type
   */
  async getAssociations(objectId: string, objectType: string): Promise<{ results: Record<string, any[]> }> {
    this.logger.info(`Fetching associations for ${objectType} ${objectId}`);
    
    try {
      // For deals, we're typically interested in contacts and companies
      const toObjectTypes = ['contacts', 'companies'];
      const results: Record<string, any[]> = {};
      
      // Initialize empty results for each type
      for (const toType of toObjectTypes) {
        results[toType] = [];
      }
      
      // Use the batch read endpoint for each type of association
      for (const toObjectType of toObjectTypes) {
        try {
          // The correct endpoint format for Associations V3 API
          // Singular for fromObjectType, plural for toObjectType
          const endpoint = `${this.crmBaseUrl}/associations/${objectType}/${toObjectType}/batch/read`;
          
          // Make the request with the input array of IDs
          const response: { results?: Array<{ to?: Array<{ id: string, type?: string }> }> } = await this.makeJsonRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify({
              inputs: [{ id: objectId }]
            })
          });
          
          // Process the response
          if (response?.results && Array.isArray(response.results) && response.results.length > 0) {
            const associationResult = response.results[0];
            
            // If we have associations, add them to the results
            if (associationResult?.to && Array.isArray(associationResult.to)) {
              const associatedIds = associationResult.to.map((assoc) => ({
                id: assoc.id,
                type: assoc.type || 'default'
              }));
              
              results[toObjectType] = associatedIds;
            }
          }
        } catch (typeError) {
          this.logger.error(`Error fetching ${toObjectType} associations for ${objectType} ${objectId}:`, typeError);
          // Continue with other types if one fails
        }
      }
      
      // Log the results
      const totalAssociations = Object.values(results).reduce(
        (sum, associations) => sum + associations.length, 0
      );
      
      this.logger.info(`Found ${totalAssociations} total associations for ${objectType} ${objectId}`, {
        contactsCount: results.contacts?.length || 0,
        companiesCount: results.companies?.length || 0
      });
      
      return { results };
    } catch (error) {
      this.logger.error(`Error fetching associations for ${objectType} ${objectId}:`, error);
      return { results: {} };
    }
  }

  /**
   * Get associations for a specific deal
   * @param dealId The ID of the deal
   * @returns Object containing associations grouped by type
   */
  async getDealAssociations(dealId: string): Promise<{ results: Record<string, any[]> }> {
    return this.getAssociations(dealId, 'deal');
  }

  /**
   * Get associations for a specific contact
   * @param contactId The ID of the contact
   * @returns Object containing associations grouped by type
   */
  async getContactAssociations(contactId: string): Promise<{ results: Record<string, any[]> }> {
    return this.getAssociations(contactId, 'contact');
  }

  /**
   * Get associations for a specific company
   * @param companyId The ID of the company
   * @returns Object containing associations grouped by type
   */
  async getCompanyAssociations(companyId: string): Promise<{ results: Record<string, any[]> }> {
    return this.getAssociations(companyId, 'company');
  }
} 