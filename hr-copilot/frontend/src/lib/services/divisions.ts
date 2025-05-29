import { dataEdge } from '../data-edge';

export interface Division {
  id: string;
  name: string;
  company_id: string;
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

export async function getDivisions(): Promise<Division[]> {
  try {
    const data = await dataEdge({
      insightId: 'getDivisions'
    });

    return data;
  } catch (error) {
    console.error('Error fetching divisions:', error);
    return [];
  }
}

export async function getDivision(id: string): Promise<Division | null> {
  try {
    const data = await dataEdge({
      insightId: 'getDivision',
      params: { id }
    });

    return data;
  } catch (error) {
    console.error('Error fetching division:', error);
    return null;
  }
} 