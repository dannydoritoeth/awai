import { dataEdge } from '../data-edge';

export interface Institution {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  company_count: number;
  division_count: number;
  created_at: string;
}

export interface InstitutionDetail extends Institution {
  companies: Array<{
    id: string;
    name: string;
    description: string | null;
    divisions: Array<{
      id: string;
      name: string;
      cluster: string | null;
      agency: string | null;
    }>;
  }>;
}

export interface InstitutionFilters {
  searchTerm?: string;
  [key: string]: string | undefined;
}

export async function getInstitutions(filters?: InstitutionFilters) {
  return dataEdge({
    insightId: 'getInstitutions',
    params: filters
  }) as Promise<Institution[]>;
}

export async function getInstitution(id: string) {
  return dataEdge({
    insightId: 'getInstitution',
    params: { id }
  }) as Promise<InstitutionDetail>;
} 