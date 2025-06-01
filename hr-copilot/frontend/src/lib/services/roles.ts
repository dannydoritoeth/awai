import { dataEdge } from '../data-edge';

export interface Role {
  id: string;
  title: string;
  description?: string | null;
  function_area?: string;
  grade_band?: string;
  primary_purpose?: string;
  reporting_line?: string;
  direct_reports?: string;
  budget_responsibility?: string;
  is_specific: boolean;
  created_at: string;
  updated_at: string;
  capabilities?: Array<{
    id: string;
    name: string;
    group_name: string;
    description?: string;
    type: string;
    level: string;
  }>;
  skills?: Array<{
    id: string;
    name: string;
    category: string;
    description?: string;
  }>;
}

export interface RoleFilters {
  taxonomies?: string[];
  regions?: string[];
  divisions?: string[];
  employmentTypes?: string[];
  capabilities?: string[];
  skills?: string[];
  companies?: string[];
  [key: string]: unknown;
}

export async function getRoles(filters?: RoleFilters) {
  return dataEdge({ 
    insightId: 'getRoles',
    params: filters
  }) as Promise<Role[]>;
}

export async function getRole(id: string, options?: {
  includeSkills?: boolean;
  includeCapabilities?: boolean;
}) {
  const response = await dataEdge({ 
    insightId: 'getRole',
    params: { id, ...options }
  });
  return response as Role;
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