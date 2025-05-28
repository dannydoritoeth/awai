import { supabase } from '../supabase';
import { dataEdge } from '../data-edge';

// Cache storage
const cache: Record<string, {
  data: any;
  timestamp: number;
}> = {};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export interface Category {
  id: string;
  name: string;
  description: string;
  type: 'taxonomy' | 'skill' | 'capability';
  parent_id?: string;
}

export interface CategoryWithStats {
  id: string;
  name: string;
  description: string | null;
  taxonomy_type?: string;
  role_count: number;
  divisions: string[];
}

interface RoleWithDivision {
  division: string;
}

export async function getCategories(type: 'taxonomy' | 'skill' | 'capability') {
  // Check cache first
  const cacheKey = `categories_${type}`;
  const now = Date.now();
  const cached = cache[cacheKey];
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }

  let data;
  if (type === 'capability') {
    data = await dataEdge({ insightId: 'getCapabilities' });
  } else if (type === 'taxonomy') {
    data = await dataEdge({ insightId: 'getTaxonomies' });
  } else {
    const { data: queryData, error } = await supabase
      .from('categories')
      .select(`
        *,
        role_count:roles(count),
        divisions:roles(division)
      `)
      .eq('type', type);

    if (error) throw error;
    
    // Process the data to get unique divisions and correct role count
    data = queryData.map(category => ({
      ...category,
      role_count: category.role_count[0]?.count || 0,
      divisions: [...new Set(category.divisions.map((d: RoleWithDivision) => d.division))],
    })) as CategoryWithStats[];
  }

  // Update cache
  cache[cacheKey] = {
    data,
    timestamp: now
  };

  return data;
}

export async function getCategory(id: string) {
  const { data, error } = await supabase
    .from('categories')
    .select(`
      *,
      roles (
        id,
        title,
        summary,
        band,
        division
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getCategoryRoles(id: string, filters: {
  division?: string;
  band?: string;
} = {}) {
  let query = supabase
    .from('category_roles')
    .select(`
      role_id,
      roles (
        id,
        title,
        summary,
        band,
        division
      )
    `)
    .eq('category_id', id);

  if (filters.division) {
    query = query.eq('roles.division', filters.division);
  }
  if (filters.band) {
    query = query.eq('roles.band', filters.band);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map(item => item.roles);
}

export async function getDivisions() {
  const { data, error } = await supabase
    .from('divisions')
    .select('*');

  if (error) throw error;
  return data;
} 