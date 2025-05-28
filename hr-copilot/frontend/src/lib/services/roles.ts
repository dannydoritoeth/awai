import { dataEdge } from '../data-edge';

export interface Role {
  id: string;
  title: string;
  description: string | null;
  is_specific: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleWithSkills extends Role {
  skills: Array<{
    id: string;
    name: string;
    category: string;
    required_level: number;
  }>;
}

export interface RoleFilters {
  type?: 'general' | 'specific';
  searchTerm?: string;
  [key: string]: string | undefined;
}

export async function getRoles(filters?: RoleFilters) {
  return dataEdge({ 
    insightId: 'getRoles',
    params: filters
  }) as Promise<Role[]>;
}

export async function getRole(id: string) {
  return dataEdge({ 
    insightId: 'getRole',
    params: { id }
  }) as Promise<RoleWithSkills>;
}

export async function getTaxonomies() {
  const { data, error } = await supabase
    .from('taxonomies')
    .select('*');

  if (error) throw error;
  return data;
}

export async function getBands() {
  const { data, error } = await supabase
    .from('bands')
    .select('*');

  if (error) throw error;
  return data;
}

export async function getAgencies() {
  const { data, error } = await supabase
    .from('agencies')
    .select('*');

  if (error) throw error;
  return data;
} 