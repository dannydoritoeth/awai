import { dataEdge } from '../data-edge';

export interface Company {
  id: string;
  name: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  created_at: string;
  divisions?: Array<{
    id: string;
    name: string;
    cluster: string | null;
    agency: string | null;
  }>;
}

export interface CompanyFilters {
  searchTerm?: string;
  divisions?: string[];
  [key: string]: unknown;
}

export async function getCompanies(filters?: CompanyFilters) {
  return dataEdge({ 
    insightId: 'getCompanies',
    params: filters
  });
}

export async function getCompany(id: string) {
  return dataEdge({ 
    insightId: 'getCompany',
    params: { id }
  });
} 