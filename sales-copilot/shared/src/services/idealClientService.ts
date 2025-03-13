import { 
  IdealClientServiceInterface, 
  IdealClientData, 
  ProcessResult, 
  StoreResult,
  HubspotClientInterface,
  Logger
} from '../types';
import { logger } from '../utils/logger';

/**
 * IdealClientService implementation that works in both Node.js and Deno environments
 */
export class IdealClientService implements IdealClientServiceInterface {
  private vectorStore: any | null = null;
  private namespace: string = '';
  
  constructor(private logger: Logger = logger) {}

  /**
   * Set the vector store to use for storing processed data
   */
  setVectorStore(vectorStore: any, namespace: string): void {
    this.vectorStore = vectorStore;
    this.namespace = namespace;
    this.logger.info(`Vector store set with namespace: ${namespace}`);
  }

  /**
   * Validate and normalize the label
   */
  validateLabel(label: string): string {
    if (!label) {
      throw new Error('Label is required');
    }
    
    // Normalize to one of: 'ideal' or 'less-ideal'
    const normalizedLabel = label.toLowerCase().trim();
    if (normalizedLabel === 'ideal' || normalizedLabel === 'less-ideal') {
      return normalizedLabel;
    }
    
    if (normalizedLabel.includes('ideal') && normalizedLabel.includes('less')) {
      return 'less-ideal';
    }
    
    if (normalizedLabel.includes('ideal')) {
      return 'ideal';
    }
    
    throw new Error(`Invalid label: ${label}. Must be 'ideal' or 'less-ideal'`);
  }

  /**
   * Validate and normalize the type
   */
  validateType(type: string): string {
    if (!type) {
      throw new Error('Type is required');
    }
    
    // Normalize to one of: 'contacts', 'companies', or 'deals'
    const normalizedType = type.toLowerCase().trim();
    const validTypes = ['contacts', 'companies', 'deals'];
    
    if (validTypes.includes(normalizedType)) {
      return normalizedType;
    }
    
    // Handle singular forms
    if (normalizedType === 'contact') return 'contacts';
    if (normalizedType === 'company') return 'companies';
    if (normalizedType === 'deal') return 'deals';
    
    throw new Error(`Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`);
  }

  /**
   * Store ideal client data in the vector store
   */
  async storeIdealClientData(data: any, type: string, label: string): Promise<StoreResult> {
    try {
      if (!this.vectorStore) {
        throw new Error('Vector store not set. Call setVectorStore first.');
      }
      
      const validatedType = this.validateType(type);
      const validatedLabel = this.validateLabel(label);
      
      this.logger.info(`Storing ${validatedLabel} ${validatedType} data`);
      
      // Process the data to create a text representation
      let textRepresentation = '';
      let metadata = {};
      
      if (validatedType === 'contacts') {
        textRepresentation = this.createContactTextRepresentation(data, validatedLabel === 'ideal');
        metadata = {
          id: data.id,
          type: 'contact',
          isIdeal: validatedLabel === 'ideal'
        };
      } else if (validatedType === 'companies') {
        textRepresentation = this.createCompanyTextRepresentation(data, validatedLabel === 'ideal');
        metadata = {
          id: data.id,
          type: 'company',
          isIdeal: validatedLabel === 'ideal'
        };
      } else if (validatedType === 'deals') {
        textRepresentation = this.createDealTextRepresentation(data, validatedLabel === 'ideal');
        metadata = {
          id: data.id,
          type: 'deal',
          isIdeal: validatedLabel === 'ideal'
        };
      }
      
      // Store in vector store
      const result = await this.vectorStore.storeDocument(
        textRepresentation,
        metadata,
        this.namespace
      );
      
      return {
        stored: true,
        type: validatedType,
        label: validatedLabel,
        id: data.id,
        vectorId: result.id,
        namespace: this.namespace
      };
    } catch (error) {
      this.logger.error(`Error storing ${label} ${type} data:`, error);
      return {
        stored: false,
        type,
        label,
        id: data?.id || 'unknown',
        vectorId: '',
        namespace: this.namespace
      };
    }
  }

  /**
   * Process HubSpot lists to extract and store ideal client data
   */
  async processHubSpotLists(hubspotClient: HubspotClientInterface, type: string): Promise<ProcessResult> {
    try {
      const validatedType = this.validateType(type);
      
      this.logger.info(`Processing HubSpot lists for ${validatedType}`);
      
      // Get ideal and less-ideal data from HubSpot
      const data = await hubspotClient.getIdealAndLessIdealData(validatedType);
      
      this.logger.info(`Retrieved ideal and less-ideal ${validatedType}`, {
        idealCount: data.ideal.length,
        lessIdealCount: data.lessIdeal.length
      });
      
      // Process the data to extract relevant information
      const processedData = this.extractRelevantData(data);
      
      // Store the processed data if a vector store is set
      let idealResults = [];
      let lessIdealResults = [];
      
      if (this.vectorStore) {
        // Store ideal data
        idealResults = await Promise.all(
          processedData.ideal.map((item: any) => 
            this.storeIdealClientData(item, validatedType, 'ideal')
          )
        );
        
        // Store less-ideal data
        lessIdealResults = await Promise.all(
          processedData.lessIdeal.map((item: any) => 
            this.storeIdealClientData(item, validatedType, 'less-ideal')
          )
        );
      }
      
      return {
        success: true,
        type: validatedType,
        summary: {
          ideal: {
            processed: processedData.ideal.length,
            successful: idealResults.filter(r => r.stored).length
          },
          lessIdeal: {
            processed: processedData.lessIdeal.length,
            successful: lessIdealResults.filter(r => r.stored).length
          }
        },
        details: {
          ideal: processedData.ideal,
          lessIdeal: processedData.lessIdeal
        }
      };
    } catch (error) {
      this.logger.error(`Error processing HubSpot lists for ${type}:`, error);
      return {
        success: false,
        type,
        summary: {
          ideal: { processed: 0, successful: 0 },
          lessIdeal: { processed: 0, successful: 0 }
        }
      };
    }
  }
  
  /**
   * Extract relevant data from HubSpot records for training
   */
  private extractRelevantData(data: IdealClientData): any {
    const { ideal, lessIdeal, type } = data;
    
    // Extract data based on record type
    if (type === 'contacts') {
      return {
        ideal: ideal.map(contact => this.extractContactData(contact, true)),
        lessIdeal: lessIdeal.map(contact => this.extractContactData(contact, false))
      };
    } else if (type === 'companies') {
      return {
        ideal: ideal.map(company => this.extractCompanyData(company, true)),
        lessIdeal: lessIdeal.map(company => this.extractCompanyData(company, false))
      };
    } else if (type === 'deals') {
      return {
        ideal: ideal.map(deal => this.extractDealData(deal, true)),
        lessIdeal: lessIdeal.map(deal => this.extractDealData(deal, false))
      };
    }
    
    return { ideal: [], lessIdeal: [] };
  }
  
  /**
   * Extract relevant data from a contact record
   */
  private extractContactData(contact: any, isIdeal: boolean): any {
    const properties = contact.properties || {};
    const companies = contact.enriched?.companies || [];
    const deals = contact.enriched?.deals || [];
    
    // Create a structured representation of the contact
    return {
      id: contact.id,
      isIdeal,
      type: 'contact',
      name: `${properties.firstname || ''} ${properties.lastname || ''}`.trim(),
      email: properties.email,
      jobTitle: properties.jobtitle,
      company: properties.company,
      industry: properties.industry,
      lifecycleStage: properties.lifecyclestage,
      leadStatus: properties.hs_lead_status,
      phone: properties.phone,
      createdAt: properties.createdate,
      lastModifiedAt: properties.lastmodifieddate,
      companies: companies.map((company: any) => ({
        id: company.id,
        name: company.properties?.name,
        domain: company.properties?.domain,
        industry: company.properties?.industry,
        size: company.properties?.numberofemployees,
        revenue: company.properties?.annualrevenue,
        companyType: company.properties?.type,
        description: company.properties?.description
      })),
      deals: deals.map((deal: any) => ({
        id: deal.id,
        name: deal.properties?.dealname,
        stage: deal.properties?.dealstage,
        amount: deal.properties?.amount,
        closeDate: deal.properties?.closedate,
        pipeline: deal.properties?.pipeline,
        dealType: deal.properties?.dealtype
      })),
      // Text representation for embedding
      textRepresentation: this.createContactTextRepresentation(contact, isIdeal)
    };
  }
  
  /**
   * Extract relevant data from a company record
   */
  private extractCompanyData(company: any, isIdeal: boolean): any {
    const properties = company.properties || {};
    const contacts = company.enriched?.contacts || [];
    const deals = company.enriched?.deals || [];
    const metrics = company.enriched?.metrics || {};
    
    // Create a structured representation of the company
    return {
      id: company.id,
      isIdeal,
      type: 'company',
      name: properties.name,
      domain: properties.domain,
      industry: properties.industry,
      companyType: properties.type,
      location: `${properties.city || ''} ${properties.state || ''} ${properties.country || ''}`.trim(),
      phone: properties.phone,
      lifecycleStage: properties.lifecyclestage,
      size: properties.numberofemployees,
      revenue: properties.annualrevenue,
      description: properties.description,
      createdAt: properties.createdate,
      lastModifiedAt: properties.hs_lastmodifieddate,
      contacts: contacts.map((contact: any) => ({
        id: contact.id,
        name: `${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}`.trim(),
        email: contact.properties?.email,
        jobTitle: contact.properties?.jobtitle,
        leadStatus: contact.properties?.hs_lead_status,
        lifecycleStage: contact.properties?.lifecyclestage
      })),
      deals: deals.map((deal: any) => ({
        id: deal.id,
        name: deal.properties?.dealname,
        stage: deal.properties?.dealstage,
        amount: deal.properties?.amount,
        closeDate: deal.properties?.closedate,
        pipeline: deal.properties?.pipeline,
        dealType: deal.properties?.dealtype
      })),
      metrics,
      // Text representation for embedding
      textRepresentation: this.createCompanyTextRepresentation(company, isIdeal)
    };
  }
  
  /**
   * Extract relevant data from a deal record
   */
  private extractDealData(deal: any, isIdeal: boolean): any {
    const properties = deal.properties || {};
    const contacts = deal.enriched?.contacts || [];
    const companies = deal.enriched?.companies || [];
    const lineItems = deal.enriched?.lineItems || [];
    const metrics = deal.enriched?.metrics || {};
    
    // Create a structured representation of the deal
    return {
      id: deal.id,
      isIdeal,
      type: 'deal',
      name: properties.dealname,
      stage: properties.dealstage,
      amount: properties.amount,
      closeDate: properties.closedate,
      pipeline: properties.pipeline,
      dealType: properties.dealtype,
      description: properties.description,
      priority: properties.hs_priority,
      createdAt: properties.createdate,
      lastModifiedAt: properties.hs_lastmodifieddate,
      contacts: contacts.map((contact: any) => ({
        id: contact.id,
        name: `${contact.properties?.firstname || ''} ${contact.properties?.lastname || ''}`.trim(),
        email: contact.properties?.email,
        jobTitle: contact.properties?.jobtitle,
        leadStatus: contact.properties?.hs_lead_status,
        lifecycleStage: contact.properties?.lifecyclestage
      })),
      companies: companies.map((company: any) => ({
        id: company.id,
        name: company.properties?.name,
        domain: company.properties?.domain,
        industry: company.properties?.industry,
        size: company.properties?.numberofemployees,
        revenue: company.properties?.annualrevenue,
        companyType: company.properties?.type
      })),
      lineItems: lineItems.map((item: any) => ({
        id: item.id,
        name: item.properties?.name,
        quantity: item.properties?.quantity,
        price: item.properties?.price,
        amount: item.properties?.amount,
        description: item.properties?.description,
        sku: item.properties?.hs_sku
      })),
      metrics,
      // Text representation for embedding
      textRepresentation: this.createDealTextRepresentation(deal, isIdeal)
    };
  }
  
  /**
   * Create a text representation of a contact for embedding
   */
  private createContactTextRepresentation(contact: any, isIdeal: boolean): string {
    const properties = contact.properties || {};
    const companies = contact.enriched?.companies || [];
    const deals = contact.enriched?.deals || [];
    
    let text = `This is ${isIdeal ? 'an ideal' : 'a less ideal'} contact.\n`;
    
    // Add contact details
    text += `Name: ${properties.firstname || ''} ${properties.lastname || ''}\n`;
    if (properties.email) text += `Email: ${properties.email}\n`;
    if (properties.jobtitle) text += `Job Title: ${properties.jobtitle}\n`;
    if (properties.company) text += `Company: ${properties.company}\n`;
    if (properties.industry) text += `Industry: ${properties.industry}\n`;
    if (properties.lifecyclestage) text += `Lifecycle Stage: ${properties.lifecyclestage}\n`;
    if (properties.hs_lead_status) text += `Lead Status: ${properties.hs_lead_status}\n`;
    if (properties.phone) text += `Phone: ${properties.phone}\n`;
    
    // Add company information
    if (companies.length > 0) {
      text += `\nAssociated Companies:\n`;
      companies.forEach((company: any, index: number) => {
        const companyProps = company.properties || {};
        text += `Company ${index + 1}: ${companyProps.name || 'Unknown'}\n`;
        if (companyProps.domain) text += `Domain: ${companyProps.domain}\n`;
        if (companyProps.industry) text += `Industry: ${companyProps.industry}\n`;
        if (companyProps.numberofemployees) text += `Size: ${companyProps.numberofemployees} employees\n`;
        if (companyProps.annualrevenue) text += `Revenue: ${companyProps.annualrevenue}\n`;
        if (companyProps.type) text += `Type: ${companyProps.type}\n`;
        if (companyProps.description) text += `Description: ${companyProps.description}\n`;
      });
    }
    
    // Add deal information
    if (deals.length > 0) {
      text += `\nAssociated Deals:\n`;
      deals.forEach((deal: any, index: number) => {
        const dealProps = deal.properties || {};
        text += `Deal ${index + 1}: ${dealProps.dealname || 'Unknown'}\n`;
        if (dealProps.dealstage) text += `Stage: ${dealProps.dealstage}\n`;
        if (dealProps.amount) text += `Amount: ${dealProps.amount}\n`;
        if (dealProps.closedate) text += `Close Date: ${dealProps.closedate}\n`;
        if (dealProps.pipeline) text += `Pipeline: ${dealProps.pipeline}\n`;
        if (dealProps.dealtype) text += `Type: ${dealProps.dealtype}\n`;
      });
    }
    
    // Add ideal/less-ideal classification
    text += `\nThis contact is classified as ${isIdeal ? 'an ideal' : 'a less ideal'} client.`;
    
    return text;
  }
  
  /**
   * Create a text representation of a company for embedding
   */
  private createCompanyTextRepresentation(company: any, isIdeal: boolean): string {
    const properties = company.properties || {};
    const contacts = company.enriched?.contacts || [];
    const deals = company.enriched?.deals || [];
    const metrics = company.enriched?.metrics || {};
    
    let text = `This is ${isIdeal ? 'an ideal' : 'a less ideal'} company.\n`;
    
    // Add company details
    text += `Name: ${properties.name || 'Unknown'}\n`;
    if (properties.domain) text += `Domain: ${properties.domain}\n`;
    if (properties.industry) text += `Industry: ${properties.industry}\n`;
    if (properties.type) text += `Type: ${properties.type}\n`;
    if (properties.city || properties.state || properties.country) {
      text += `Location: ${[properties.city, properties.state, properties.country].filter(Boolean).join(', ')}\n`;
    }
    if (properties.phone) text += `Phone: ${properties.phone}\n`;
    if (properties.lifecyclestage) text += `Lifecycle Stage: ${properties.lifecyclestage}\n`;
    if (properties.numberofemployees) text += `Size: ${properties.numberofemployees} employees\n`;
    if (properties.annualrevenue) text += `Revenue: ${properties.annualrevenue}\n`;
    if (properties.description) text += `Description: ${properties.description}\n`;
    
    // Add metrics
    if (Object.keys(metrics).length > 0) {
      text += `\nCompany Metrics:\n`;
      if (metrics.totalRevenue !== undefined) text += `Total Revenue: ${metrics.totalRevenue}\n`;
      if (metrics.totalDeals !== undefined) text += `Total Deals: ${metrics.totalDeals}\n`;
      if (metrics.wonDeals !== undefined) text += `Won Deals: ${metrics.wonDeals}\n`;
      if (metrics.activeContacts !== undefined) text += `Active Contacts: ${metrics.activeContacts}\n`;
      if (metrics.totalContacts !== undefined) text += `Total Contacts: ${metrics.totalContacts}\n`;
    }
    
    // Add contact information
    if (contacts.length > 0) {
      text += `\nAssociated Contacts:\n`;
      contacts.forEach((contact: any, index: number) => {
        const contactProps = contact.properties || {};
        text += `Contact ${index + 1}: ${[contactProps.firstname, contactProps.lastname].filter(Boolean).join(' ') || 'Unknown'}\n`;
        if (contactProps.email) text += `Email: ${contactProps.email}\n`;
        if (contactProps.jobtitle) text += `Job Title: ${contactProps.jobtitle}\n`;
        if (contactProps.lifecyclestage) text += `Lifecycle Stage: ${contactProps.lifecyclestage}\n`;
        if (contactProps.hs_lead_status) text += `Lead Status: ${contactProps.hs_lead_status}\n`;
      });
    }
    
    // Add deal information
    if (deals.length > 0) {
      text += `\nAssociated Deals:\n`;
      deals.forEach((deal: any, index: number) => {
        const dealProps = deal.properties || {};
        text += `Deal ${index + 1}: ${dealProps.dealname || 'Unknown'}\n`;
        if (dealProps.dealstage) text += `Stage: ${dealProps.dealstage}\n`;
        if (dealProps.amount) text += `Amount: ${dealProps.amount}\n`;
        if (dealProps.closedate) text += `Close Date: ${dealProps.closedate}\n`;
        if (dealProps.pipeline) text += `Pipeline: ${dealProps.pipeline}\n`;
        if (dealProps.dealtype) text += `Type: ${dealProps.dealtype}\n`;
      });
    }
    
    // Add ideal/less-ideal classification
    text += `\nThis company is classified as ${isIdeal ? 'an ideal' : 'a less ideal'} client.`;
    
    return text;
  }
  
  /**
   * Create a text representation of a deal for embedding
   */
  private createDealTextRepresentation(deal: any, isIdeal: boolean): string {
    const properties = deal.properties || {};
    const contacts = deal.enriched?.contacts || [];
    const companies = deal.enriched?.companies || [];
    const lineItems = deal.enriched?.lineItems || [];
    const metrics = deal.enriched?.metrics || {};
    
    let text = `This is ${isIdeal ? 'an ideal' : 'a less ideal'} deal.\n`;
    
    // Add deal details
    text += `Name: ${properties.dealname || 'Unknown'}\n`;
    if (properties.dealstage) text += `Stage: ${properties.dealstage}\n`;
    if (properties.amount) text += `Amount: ${properties.amount}\n`;
    if (properties.closedate) text += `Close Date: ${properties.closedate}\n`;
    if (properties.pipeline) text += `Pipeline: ${properties.pipeline}\n`;
    if (properties.dealtype) text += `Type: ${properties.dealtype}\n`;
    if (properties.description) text += `Description: ${properties.description}\n`;
    if (properties.hs_priority) text += `Priority: ${properties.hs_priority}\n`;
    
    // Add metrics
    if (Object.keys(metrics).length > 0) {
      text += `\nDeal Metrics:\n`;
      if (metrics.totalValue !== undefined) text += `Total Value: ${metrics.totalValue}\n`;
      if (metrics.lineItemCount !== undefined) text += `Line Item Count: ${metrics.lineItemCount}\n`;
      if (metrics.contactCount !== undefined) text += `Contact Count: ${metrics.contactCount}\n`;
      if (metrics.companyCount !== undefined) text += `Company Count: ${metrics.companyCount}\n`;
      if (metrics.salesCycleDays !== undefined) text += `Sales Cycle Days: ${metrics.salesCycleDays}\n`;
    }
    
    // Add contact information
    if (contacts.length > 0) {
      text += `\nAssociated Contacts:\n`;
      contacts.forEach((contact: any, index: number) => {
        const contactProps = contact.properties || {};
        text += `Contact ${index + 1}: ${[contactProps.firstname, contactProps.lastname].filter(Boolean).join(' ') || 'Unknown'}\n`;
        if (contactProps.email) text += `Email: ${contactProps.email}\n`;
        if (contactProps.jobtitle) text += `Job Title: ${contactProps.jobtitle}\n`;
        if (contactProps.lifecyclestage) text += `Lifecycle Stage: ${contactProps.lifecyclestage}\n`;
        if (contactProps.hs_lead_status) text += `Lead Status: ${contactProps.hs_lead_status}\n`;
      });
    }
    
    // Add company information
    if (companies.length > 0) {
      text += `\nAssociated Companies:\n`;
      companies.forEach((company: any, index: number) => {
        const companyProps = company.properties || {};
        text += `Company ${index + 1}: ${companyProps.name || 'Unknown'}\n`;
        if (companyProps.domain) text += `Domain: ${companyProps.domain}\n`;
        if (companyProps.industry) text += `Industry: ${companyProps.industry}\n`;
        if (companyProps.numberofemployees) text += `Size: ${companyProps.numberofemployees} employees\n`;
        if (companyProps.annualrevenue) text += `Revenue: ${companyProps.annualrevenue}\n`;
        if (companyProps.type) text += `Type: ${companyProps.type}\n`;
      });
    }
    
    // Add line item information
    if (lineItems.length > 0) {
      text += `\nLine Items:\n`;
      lineItems.forEach((item: any, index: number) => {
        const itemProps = item.properties || {};
        text += `Item ${index + 1}: ${itemProps.name || 'Unknown'}\n`;
        if (itemProps.quantity) text += `Quantity: ${itemProps.quantity}\n`;
        if (itemProps.price) text += `Price: ${itemProps.price}\n`;
        if (itemProps.amount) text += `Amount: ${itemProps.amount}\n`;
        if (itemProps.description) text += `Description: ${itemProps.description}\n`;
        if (itemProps.hs_sku) text += `SKU: ${itemProps.hs_sku}\n`;
      });
    }
    
    // Add ideal/less-ideal classification
    text += `\nThis deal is classified as ${isIdeal ? 'an ideal' : 'a less ideal'} client deal.`;
    
    return text;
  }
} 