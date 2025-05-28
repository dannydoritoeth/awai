import { dataEdge } from '../data-edge';

export interface Company {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  created_at: string;
}

export interface CompanyFilters {
  searchTerm?: string;
  divisions?: string[];
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