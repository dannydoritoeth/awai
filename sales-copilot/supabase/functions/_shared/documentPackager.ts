import { Logger } from './logger.ts';
import { HubspotClient } from './hubspotClient.ts';
import { handleApiCall } from './apiHandler.ts';

interface DocumentMetadata {
  id: string;
  portalId: string;
  recordType: 'contact' | 'company' | 'deal';
  updatedAt: string;
}

interface StructuredContent {
  primary: {
    title: string;
    description?: string;
    type: string;
    classification: string;
    score?: number;
    notes?: string;
  };
  properties: {
    [key: string]: {
      value: any;
      label: string;
      category: string;
    };
  };
  timeline?: {
    events: {
      timestamp: string;
      type: string;
      description: string;
      oldValue?: string;
      newValue?: string;
      source?: string;
    }[];
    summary?: {
      firstInteraction?: string;
      lastInteraction?: string;
      totalInteractions: number;
      significantChanges: string[];
    };
  };
  engagement?: {
    history: {
      type: string;
      timestamp: string;
      details: string;
    }[];
    metrics: {
      totalEngagements: number;
      lastEngagement?: string;
      engagementTypes: string[];
      highValueActions: string[];
    };
  };
  relationships?: {
    [key: string]: {
      type: string;
      id: string;
      name: string;
      properties?: Record<string, any>;
    }[];
  };
  customFields?: Record<string, any>;
}

interface Document {
  content: string;
  metadata: DocumentMetadata;
  structuredContent: StructuredContent;
}

export interface PropertyHistoryEntry {
  propertyName: string;
  value: any;
  source: string;
  sourceId: string;
  timestamp: string;
}

export interface EngagementHistoryEntry {
  id: string;
  type: string;
  timestamp: string;
  details: string;
}

export class DocumentPackager {
  private logger: Logger;
  private hubspotClient: HubspotClient;
  private refreshToken?: string;
  private portalId?: string;

  constructor(hubspotClient: HubspotClient, refreshToken?: string, portalId?: string) {
    this.logger = new Logger('DocumentPackager');
    this.hubspotClient = hubspotClient;
    this.refreshToken = refreshToken;
    this.portalId = portalId;
  }

  private formatPropertyValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private getTitle(record: any, recordType: string): string {
    switch (recordType) {
      case 'contact':
        // Don't include actual names, just use role-based identifier
        return `Contact ${record.id}`;
      case 'company':
        // Use industry + size category instead of actual name
        return `${record.properties.industry || 'Unknown Industry'} Company`;
      case 'deal':
        // Use deal type/category instead of actual name
        return `${record.properties.dealtype || 'Standard'} Deal`;
      default:
        return '';
    }
  }

  private getDescription(record: any, recordType: string): string {
    switch (recordType) {
      case 'contact':
        // Only include non-PII information
        return `${record.properties.jobtitle || 'Professional'} in ${record.properties.industry || 'Unknown Industry'}`;
      case 'company':
        // Use general description without specific details
        return `${record.properties.industry || 'Business'} organization`;
      case 'deal':
        // Use stage without amount
        return `${record.properties.dealstage || 'In Progress'}`;
      default:
        return '';
    }
  }

  private async buildStructuredContent(record: any, recordType: string): Promise<StructuredContent> {
    const score = parseFloat(record.properties.training_score) || undefined;
    
    // Determine classification based on score thresholds
    let classification: string;
    if (score === undefined) {
      classification = 'Unknown';
    } else if (score > 80) {
      classification = 'Ideal';
    } else if (score < 50) {
      classification = 'Less Ideal';
    } else {
      classification = 'Neutral';
    }

    const notes = record.properties.training_notes;

    const content: StructuredContent = {
      primary: {
        title: this.getTitle(record, recordType),
        description: this.getDescription(record, recordType),
        type: recordType,
        classification,
        score,
        notes
      },
      properties: {}
    };

    // Add record type specific properties
    switch (recordType) {
      case 'contact':
        content.properties = {
          industry: { value: record.properties.industry, label: 'Industry', category: 'business' },
          jobtitle: { value: record.properties.jobtitle, label: 'Job Title', category: 'professional' }
        };
        break;
      case 'company':
        content.properties = {
          industry: { value: record.properties.industry, label: 'Industry', category: 'business' },
          type: { value: record.properties.type, label: 'Type', category: 'business' },
          size_category: { 
            value: this.getSizeCategory(record.properties.numberofemployees), 
            label: 'Size Category', 
            category: 'business' 
          }
        };
        break;
      case 'deal':
        content.properties = {
          stage: { value: record.properties.dealstage, label: 'Stage', category: 'pipeline' },
          pipeline: { value: record.properties.pipeline, label: 'Pipeline', category: 'pipeline' },
          type: { value: record.properties.dealtype, label: 'Type', category: 'pipeline' }
        };
        break;
    }

    return content;
  }

  private getSizeCategory(employeeCount: string | number | null): string {
    const count = Number(employeeCount);
    if (isNaN(count)) return 'Unknown';
    if (count < 10) return 'Micro';
    if (count < 50) return 'Small';
    if (count < 250) return 'Medium';
    return 'Large';
  }

  private contentToString(content: StructuredContent): string {
    const sections: string[] = [];

    // Add primary information
    sections.push(`# ${content.primary.title}`);
    if (content.primary.description) {
      sections.push(content.primary.description);
    }
    sections.push(`Type: ${content.primary.type}`);
    sections.push(`Classification: ${content.primary.classification}`);
    if (content.primary.score !== undefined) {
      sections.push(`Score: ${content.primary.score}`);
    }
    if (content.primary.notes) {
      sections.push(`Notes: ${content.primary.notes}`);
    }

    // Add properties by category
    const categorizedProperties = Object.entries(content.properties).reduce((acc, [key, prop]) => {
      if (!acc[prop.category]) {
        acc[prop.category] = [];
      }
      if (prop.value) {
        acc[prop.category].push(`${prop.label}: ${this.formatPropertyValue(prop.value)}`);
      }
      return acc;
    }, {} as Record<string, string[]>);

    Object.entries(categorizedProperties).forEach(([category, props]) => {
      if (props.length > 0) {
        sections.push(`\n## ${category.charAt(0).toUpperCase() + category.slice(1)}`);
        sections.push(props.join('\n'));
      }
    });

    return sections.join('\n\n');
  }

  private async getRelatedCompany(companyId: string): Promise<any | null> {
    if (!companyId) return null;
    try {
      let company;
      if (this.refreshToken && this.portalId) {
        company = await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.getRecord('company', companyId, [
            'industry',
            'type',
            'numberofemployees',
            'training_score'
          ])
        );
      } else {
        company = await this.hubspotClient.getRecord('company', companyId, [
          'industry',
          'type',
          'numberofemployees',
          'training_score'
        ]);
      }
      return company;
    } catch (error) {
      this.logger.warn(`Failed to fetch related company ${companyId}:`, error);
      return null;
    }
  }

  private async getRelatedContacts(companyId: string): Promise<any[]> {
    try {
      let searchResults;
      if (this.refreshToken && this.portalId) {
        searchResults = await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.searchRecords('contact', {
            filterGroups: [{
              filters: [{
                propertyName: 'associations.company',
                operator: 'EQ',
                value: companyId
              }]
            }],
            properties: [
              'firstname',
              'lastname',
              'email',
              'jobtitle',
              'training_classification',
              'training_score'
            ],
            limit: 10
          })
        );
      } else {
        searchResults = await this.hubspotClient.searchRecords('contact', {
          filterGroups: [{
            filters: [{
              propertyName: 'associations.company',
              operator: 'EQ',
              value: companyId
            }]
          }],
          properties: [
            'firstname',
            'lastname',
            'email',
            'jobtitle',
            'training_classification',
            'training_score'
          ],
          limit: 10
        });
      }
      return searchResults.results || [];
    } catch (error) {
      this.logger.warn(`Failed to fetch related contacts for company ${companyId}:`, error);
      return [];
    }
  }

  private async getRelatedDeals(companyId: string): Promise<any[]> {
    try {
      let searchResults;
      if (this.refreshToken && this.portalId) {
        searchResults = await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.searchRecords('deal', {
            filterGroups: [{
              filters: [{
                propertyName: 'associations.company',
                operator: 'EQ',
                value: companyId
              }]
            }],
            properties: [
              'dealname',
              'amount',
              'pipeline',
              'dealstage',
              'closedate',
              'training_classification',
              'training_score'
            ],
            limit: 10
          })
        );
      } else {
        searchResults = await this.hubspotClient.searchRecords('deal', {
          filterGroups: [{
            filters: [{
              propertyName: 'associations.company',
              operator: 'EQ',
              value: companyId
            }]
          }],
          properties: [
            'dealname',
            'amount',
            'pipeline',
            'dealstage',
            'closedate',
            'training_classification',
            'training_score'
          ],
          limit: 10
        });
      }
      return searchResults.results || [];
    } catch (error) {
      this.logger.warn(`Failed to fetch related deals for company ${companyId}:`, error);
      return [];
    }
  }

  private async enrichWithRelationships(content: StructuredContent, record: any, recordType: 'contact' | 'company' | 'deal'): Promise<void> {
    content.relationships = {};

    switch (recordType) {
      case 'contact': {
        // Get related company if contact has one
        const companyId = record.properties.company_id || record.associations?.companies?.[0];
        if (companyId) {
          const company = await this.getRelatedCompany(companyId);
          if (company) {
            content.relationships.company = [{
              type: 'company',
              id: company.id,
              name: company.properties.name,
              properties: {
                industry: company.properties.industry,
                type: company.properties.type,
                size: company.properties.numberofemployees,
                classification: company.properties.training_classification,
                score: company.properties.training_score
              }
            }];
          }
        }

        // Get related deals
        const deals = await this.getRelatedDeals(record.id);
        if (deals.length > 0) {
          content.relationships.deals = deals.map(deal => ({
            type: 'deal',
            id: deal.id,
            name: deal.properties.dealname,
            properties: {
              amount: deal.properties.amount,
              stage: deal.properties.dealstage,
              pipeline: deal.properties.pipeline,
              closedate: deal.properties.closedate,
              classification: deal.properties.training_classification,
              score: deal.properties.training_score
            }
          }));
        }
        break;
      }

      case 'company': {
        // Get related contacts
        const contacts = await this.getRelatedContacts(record.id);
        if (contacts.length > 0) {
          content.relationships.contacts = contacts.map(contact => ({
            type: 'contact',
            id: contact.id,
            name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
            properties: {
              email: contact.properties.email,
              jobtitle: contact.properties.jobtitle,
              classification: contact.properties.training_classification,
              score: contact.properties.training_score
            }
          }));
        }

        // Get related deals
        const deals = await this.getRelatedDeals(record.id);
        if (deals.length > 0) {
          content.relationships.deals = deals.map(deal => ({
            type: 'deal',
            id: deal.id,
            name: deal.properties.dealname,
            properties: {
              amount: deal.properties.amount,
              stage: deal.properties.dealstage,
              pipeline: deal.properties.pipeline,
              closedate: deal.properties.closedate,
              classification: deal.properties.training_classification,
              score: deal.properties.training_score
            }
          }));
        }
        break;
      }

      case 'deal': {
        // Get related company
        const companyId = record.properties.company_id || record.associations?.companies?.[0];
        if (companyId) {
          const company = await this.getRelatedCompany(companyId);
          if (company) {
            content.relationships.company = [{
              type: 'company',
              id: company.id,
              name: company.properties.name,
              properties: {
                industry: company.properties.industry,
                type: company.properties.type,
                size: company.properties.numberofemployees,
                classification: company.properties.training_classification,
                score: company.properties.training_score
              }
            }];
          }
        }

        // Get related contacts
        const contacts = await this.getRelatedContacts(companyId);
        if (contacts.length > 0) {
          content.relationships.contacts = contacts.map(contact => ({
            type: 'contact',
            id: contact.id,
            name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
            properties: {
              email: contact.properties.email,
              jobtitle: contact.properties.jobtitle,
              classification: contact.properties.training_classification,
              score: contact.properties.training_score
            }
          }));
        }
        break;
      }
    }
  }

  private async buildTimeline(record: any, recordType: string): Promise<StructuredContent['timeline']> {
    const events: StructuredContent['timeline']['events'] = [];
    
    try {
      // Get property history for important properties
      const propertyNamesToTrack = [
        'lifecyclestage', 
        'hs_lead_status', 
        'dealstage',
        'amount',
        'closedate'
      ];
      
      let propertyHistory;
      if (this.refreshToken && this.portalId) {
        propertyHistory = await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.getPropertyHistory(record.id, recordType, propertyNamesToTrack)
        );
      } else {
        propertyHistory = await this.hubspotClient.getPropertyHistory(record.id, recordType, propertyNamesToTrack);
      }
      
      // Format property history into timeline events
      for (const entry of propertyHistory) {
        if (!propertyNamesToTrack.includes(entry.propertyName)) continue;
        
        events.push({
          timestamp: entry.timestamp,
          type: `Property ${entry.propertyName} changed`,
          description: `Changed from "${entry.oldValue || 'empty'}" to "${entry.newValue || 'empty'}"`,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          source: entry.source
        });
      }
      
      // Get engagement history (calls, emails, meetings)
      let engagements;
      if (this.refreshToken && this.portalId) {
        engagements = await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.getEngagementHistory(record.id, recordType)
        );
      } else {
        engagements = await this.hubspotClient.getEngagementHistory(record.id, recordType);
      }
      
      // Add engagements to timeline
      for (const engagement of engagements) {
        events.push({
          timestamp: engagement.timestamp,
          type: engagement.type,
          description: engagement.details
        });
      }
      
      // Sort events by timestamp
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      // Create summary with metrics
      const summary = {
        totalInteractions: events.length,
        firstInteraction: events[0]?.timestamp,
        lastInteraction: events[events.length - 1]?.timestamp,
        significantChanges: events
          .filter(e => e.type.includes('changed') && ['lifecyclestage', 'dealstage', 'amount'].some(p => e.type.includes(p)))
          .map(e => `${e.type}: ${e.description}`)
      };
      
      return { events, summary };
    } catch (error) {
      this.logger.warn(`Failed to build timeline for ${recordType} ${record.id}:`, error);
      return { events: [], summary: { totalInteractions: 0, significantChanges: [] } };
    }
  }

  private async buildEngagementHistory(record: any, recordType: string): Promise<StructuredContent['engagement']> {
    try {
      let engagements;
      if (this.refreshToken && this.portalId) {
        engagements = await handleApiCall(
          this.hubspotClient,
          this.portalId,
          this.refreshToken,
          () => this.hubspotClient.getEngagementHistory(record.id, recordType)
        );
      } else {
        engagements = await this.hubspotClient.getEngagementHistory(record.id, recordType);
      }
      
      const history = engagements.map(e => ({
        type: e.type,
        timestamp: e.timestamp,
        details: e.details
      }));

      // Calculate engagement metrics
      const metrics = {
        totalEngagements: history.length,
        lastEngagement: history[history.length - 1]?.timestamp,
        engagementTypes: [...new Set(history.map(h => h.type))],
        highValueActions: history
          .filter(h => [
            'downloaded_content',
            'attended_webinar',
            'requested_demo',
            'visited_pricing',
            'multiple_page_views'
          ].includes(h.type))
          .map(h => h.type)
      };

      return { history, metrics };
    } catch (error) {
      this.logger.warn(`Failed to build engagement history for ${recordType} ${record.id}:`, error);
      return { 
        history: [], 
        metrics: { 
          totalEngagements: 0, 
          engagementTypes: [], 
          highValueActions: [] 
        } 
      };
    }
  }

  public async packageDocument(record: any, recordType: 'contact' | 'company' | 'deal', portalId: string): Promise<Document> {
    const logger = new Logger('packageDocument');
    logger.info(`Packaging ${recordType} document for record ${record.id}`);

    // Build structured content for embedding generation only
    const structuredContent = await this.buildStructuredContent(record, recordType);

    // Build content string for embedding
    const content = this.contentToString(structuredContent);

    // Minimal metadata for Pinecone - only simple types
    const metadata: DocumentMetadata = {
      id: record.id.toString(),
      portalId: portalId.toString(),
      recordType,
      updatedAt: record.properties.hs_lastmodifieddate || new Date().toISOString()
    };

    logger.info(`Prepared metadata for Pinecone: ${JSON.stringify(metadata)}`);

    return {
      content,
      metadata,
      structuredContent // Only used for content generation, not stored in Pinecone
    };
  }
} 