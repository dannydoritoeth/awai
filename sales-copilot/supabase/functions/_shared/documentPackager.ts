import { Logger } from './logger.ts';
import { HubspotClient } from './hubspotClient.ts';

interface DocumentMetadata {
  id: string;
  source: string;
  portalId: string;
  score?: number;
  attributes?: string[];
  isTrainingData: boolean;
  recordType: 'contact' | 'company' | 'deal';
  createdAt?: string;
  updatedAt?: string;
  relatedIds: {
    companies: string[];
    contacts: string[];
    deals: string[];
  };
  [key: string]: any; // Allow for custom metadata fields
}

interface StructuredContent {
  primary: {
    title: string;
    description?: string;
    type: string;
    classification: string;
    score?: number;
    attributes: string[];
    notes?: string;
  };
  properties: {
    [key: string]: {
      value: any;
      label: string;
      category: string;
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

export class DocumentPackager {
  private logger: Logger;
  private hubspotClient: HubspotClient;

  constructor(hubspotClient: HubspotClient) {
    this.logger = new Logger('DocumentPackager');
    this.hubspotClient = hubspotClient;
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
    const attributes = record.properties.training_attributes?.split(';') || [];
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
        attributes,
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
    if (content.primary.attributes.length > 0) {
      sections.push(`Attributes: ${content.primary.attributes.join(', ')}`);
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

    // Add relationships if they exist
    if (content.relationships) {
      sections.push('\n## Relationships');
      Object.entries(content.relationships).forEach(([type, items]) => {
        sections.push(`\n### ${type}`);
        items.forEach(item => {
          sections.push(`- ${item.name} (${item.type})`);
          if (item.properties) {
            Object.entries(item.properties).forEach(([key, value]) => {
              sections.push(`  ${key}: ${this.formatPropertyValue(value)}`);
            });
          }
        });
      });
    }

    return sections.join('\n');
  }

  private async getRelatedCompany(companyId: string): Promise<any | null> {
    if (!companyId) return null;
    try {
      const company = await this.hubspotClient.getRecord('company', companyId, [
        'industry',
        'type',
        'numberofemployees',
        'training_score'
      ]);
      return company;
    } catch (error) {
      this.logger.warn(`Failed to fetch related company ${companyId}:`, error);
      return null;
    }
  }

  private async getRelatedDeals(objectId: string, objectType: 'contact' | 'company'): Promise<any[]> {
    try {
      const searchResults = await this.hubspotClient.searchRecords('deal', {
        filterGroups: [{
          filters: [{
            propertyName: objectType === 'contact' ? 'associations.contact' : 'associations.company',
            operator: 'EQ',
            value: objectId
          }]
        }],
        properties: [
          'dealname',
          'amount',
          'dealstage',
          'pipeline',
          'closedate',
          'training_classification',
          'training_score'
        ],
        limit: 10
      });
      return searchResults.results || [];
    } catch (error) {
      this.logger.warn(`Failed to fetch related deals for ${objectType} ${objectId}:`, error);
      return [];
    }
  }

  private async getRelatedContacts(companyId: string): Promise<any[]> {
    try {
      const searchResults = await this.hubspotClient.searchRecords('contact', {
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
      return searchResults.results || [];
    } catch (error) {
      this.logger.warn(`Failed to fetch related contacts for company ${companyId}:`, error);
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
        const deals = await this.getRelatedDeals(record.id, 'contact');
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
        const deals = await this.getRelatedDeals(record.id, 'company');
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

  async packageDocument(record: any, recordType: 'contact' | 'company' | 'deal', portalId: string): Promise<{
    content: string;
    metadata: DocumentMetadata;
    structuredContent: StructuredContent;
  }> {
    this.logger.info(`Packaging ${recordType} record ${record.id}`);

    const structuredContent = await this.buildStructuredContent(record, recordType);
    
    // Enrich the content with relationships
    await this.enrichWithRelationships(structuredContent, record, recordType);
    
    const content = this.contentToString(structuredContent);

    const metadata: DocumentMetadata = {
      id: record.id,
      source: 'hubspot',
      portalId,
      recordType,
      score: parseFloat(record.properties.training_score) || undefined,
      attributes: record.properties.training_attributes?.split(';') || [],
      isTrainingData: true,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      // Add relationship IDs to metadata for filtering
      relatedIds: {
        companies: structuredContent.relationships?.company?.map(c => c.id) || [],
        contacts: structuredContent.relationships?.contacts?.map(c => c.id) || [],
        deals: structuredContent.relationships?.deals?.map(d => d.id) || []
      }
    };

    return { content, metadata, structuredContent };
  }
} 