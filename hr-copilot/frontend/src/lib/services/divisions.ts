import { dataEdge } from '../data-edge';

export interface Division {
  id: string;
  name: string;
  cluster: string;
  agency: string;
}

export interface DivisionFilters {
  searchTerm?: string;
  cluster?: string;
  agency?: string;
}

export async function getDivisions(filters?: DivisionFilters) {
  return dataEdge({ 
    insightId: 'getDivisions',
    params: filters
  });
}

export async function getDivision(id: string) {
  return dataEdge({ 
    insightId: 'getDivision',
    params: { id }
  });
} 