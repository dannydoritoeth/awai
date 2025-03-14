export interface HubspotRecord {
  id: string;
  properties: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
}

export interface PropertyGroup {
  name: string;
  label: string;
  displayOrder: number;
}

export interface Property {
  name: string;
  label: string;
  type: string;
  groupName: string;
  options?: Array<{
    label: string;
    value: string;
    displayOrder?: number;
  }>;
}

export interface SearchRequest {
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

export interface SearchResponse<T> {
  results: T[];
  paging?: {
    next?: {
      after: string;
    };
  };
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