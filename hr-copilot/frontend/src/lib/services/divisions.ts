import { dataEdge } from '../data-edge';

export interface Division {
  id: string;
  name: string;
  cluster: string;
  agency: string;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  company?: {
    id: string;
    name: string;
    institution?: {
      id: string;
      name: string;
    };
  };
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
  try {
    const data = await dataEdge({ 
      insightId: 'getDivision',
      params: { 
        id,
        includeCompany: true
      }
    });

    return data;
  } catch (error) {
    console.error('Error in getDivision:', error);
    throw error;
  }
} 