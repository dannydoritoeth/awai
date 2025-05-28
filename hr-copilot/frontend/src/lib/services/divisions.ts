import { dataEdge } from '../data-edge';

export interface Division {
  id: string;
  name: string;
  cluster: string;
  agency: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DivisionFilters {
  searchTerm?: string;
  cluster?: string;
  agency?: string;
  [key: string]: string | undefined;
}

export async function getDivisions(filters?: DivisionFilters) {
  console.log('Fetching divisions with filters:', filters);
  const data = await dataEdge({ 
    insightId: 'getDivisions',
    params: filters
  });
  console.log('Received divisions data:', data);
  return data as Division[];
}

export async function getDivision(id: string) {
  return dataEdge({ 
    insightId: 'getDivision',
    params: { id }
  }) as Promise<Division>;
} 