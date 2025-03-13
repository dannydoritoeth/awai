// Common types used across the application

export interface Logger {
  info(message: string, data?: any): void;
  error(message: string, error?: any): void;
}

export interface HubspotList {
  id: string;
  name: string;
  size: number;
}

export interface HubspotContact {
  id: string;
  properties: Record<string, any>;
  associations?: {
    companies?: {
      results: Array<{ id: string }>;
    };
    deals?: {
      results: Array<{ id: string }>;
    };
  };
  enriched?: {
    companies: any[];
    deals: any[];
  };
}

export interface HubspotCompany {
  id: string;
  properties: Record<string, any>;
  associations?: {
    contacts?: {
      results: Array<{ id: string }>;
    };
    deals?: {
      results: Array<{ id: string }>;
    };
  };
  enriched?: {
    contacts: any[];
    deals: any[];
    metrics?: {
      totalRevenue: number;
      totalDeals: number;
      wonDeals: number;
      activeContacts: number;
      totalContacts: number;
    };
  };
}

export interface HubspotDeal {
  id: string;
  properties: Record<string, any>;
  associations?: {
    contacts?: {
      results: Array<{ id: string }>;
    };
    companies?: {
      results: Array<{ id: string }>;
    };
    line_items?: {
      results: Array<{ id: string }>;
    };
  };
  enriched?: {
    contacts: any[];
    companies: any[];
    lineItems: any[];
    metrics?: {
      totalValue: number;
      lineItemCount: number;
      contactCount: number;
      companyCount: number;
      salesCycleDays: number | null;
    };
  };
}

export interface IdealClientData {
  ideal: HubspotContact[] | HubspotCompany[] | HubspotDeal[];
  lessIdeal: HubspotContact[] | HubspotCompany[] | HubspotDeal[];
  type: string;
}

export interface ProcessResult {
  success: boolean;
  type: string;
  summary: {
    ideal: {
      processed: number;
      successful: number;
    };
    lessIdeal: {
      processed: number;
      successful: number;
    };
  };
  details?: {
    ideal: any[];
    lessIdeal: any[];
  };
}

export interface StoreResult {
  stored: boolean;
  type: string;
  label: string;
  id: string;
  vectorId: string;
  namespace: string;
}

export interface HubspotClientInterface {
  findListByName(listName: string): Promise<HubspotList>;
  getContactsFromList(listId: string): Promise<HubspotContact[]>;
  getCompaniesFromList(listId: string): Promise<HubspotCompany[]>;
  getDealsFromList(listId: string): Promise<HubspotDeal[]>;
  getIdealAndLessIdealData(type: string): Promise<IdealClientData>;
}

export interface IdealClientServiceInterface {
  setVectorStore(vectorStore: any, namespace: string): void;
  validateLabel(label: string): string;
  validateType(type: string): string;
  storeIdealClientData(data: any, type: string, label: string): Promise<StoreResult>;
  processHubSpotLists(hubspotClient: HubspotClientInterface, type: string): Promise<ProcessResult>;
} 