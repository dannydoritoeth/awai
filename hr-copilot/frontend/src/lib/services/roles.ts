import { supabase } from '../supabase';

export interface Role {
  id: string;
  title: string;
  summary: string;
  description: string;
  band: string;
  agencies: string[];
}

export interface RoleFilters {
  taxonomy?: string;
  band?: string;
  agency?: string;
}

export async function getRoles(filters: RoleFilters = {}) {
  let query = supabase.from('roles').select('*');

  if (filters.taxonomy) {
    query = query.eq('taxonomy', filters.taxonomy);
  }
  if (filters.band) {
    query = query.eq('band', filters.band);
  }
  if (filters.agency) {
    query = query.contains('agencies', [filters.agency]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Role[];
}

export async function getRole(id: string) {
  const { data, error } = await supabase
    .from('roles')
    .select(`
      *,
      transitions:role_transitions(
        to_role_id,
        from_role_id,
        frequency
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Role & {
    transitions: {
      to_role_id: string;
      from_role_id: string;
      frequency: number;
    }[];
  };
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