import { dataEdge } from '../data-edge';

export interface Company {
  id: string;
  name: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  created_at: string;
  institution_id: string | null;
  parent_company_id: string | null;
  institution?: {
    id: string;
    name: string;
  };
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
  try {
    const data = await dataEdge({ 
      insightId: 'getCompany',
      params: { 
        id,
        includeDivisions: true,
        includeInstitution: true
      }
    });

    return {
      success: true,
      data: {
        ...data,
        website_url: data.website_url || data.website,
        divisions: data.divisions || []
      },
      error: null
    };
  } catch (error) {
    console.error('Error in getCompany:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load company'
    };
  }
} 