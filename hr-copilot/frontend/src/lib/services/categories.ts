import { supabase } from '../supabase';
import { dataEdge } from '../data-edge';

// Cache storage
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: Record<string, CacheEntry<Category[] | CategoryWithStats[]>> = {};

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
  console.log(`getCategories called with type: ${type}`);
  
  // Check cache first
  const cacheKey = `categories_${type}`;
  const now = Date.now();
  const cached = cache[cacheKey];
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    console.log(`Returning cached data for ${type}`);
    return cached.data;
  }

  try {
    console.log(`Fetching fresh data for ${type}`);
    let data;
    
    if (type === 'capability') {
      console.log('Fetching capabilities from dataEdge');
      data = await dataEdge({ insightId: 'getCapabilities' })
        .catch(err => {
          console.error('Error in dataEdge getCapabilities:', err);
          return [];
        });
      console.log('Received capabilities data:', data);
    } else if (type === 'taxonomy') {
      console.log('Fetching taxonomies from dataEdge');
      data = await dataEdge({ insightId: 'getTaxonomies' })
        .catch(err => {
          console.error('Error in dataEdge getTaxonomies:', err);
          return [];
        });
      console.log('Received taxonomies data:', data);
    } else {
      console.log('Fetching from categories table');
      const { data: queryData, error } = await supabase
        .from('categories')
        .select(`
          *,
          role_count:roles(count),
          divisions:roles(division)
        `)
        .eq('type', type);

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      
      // Process the data to get unique divisions and correct role count
      data = queryData.map(category => ({
        ...category,
        role_count: category.role_count[0]?.count || 0,
        divisions: [...new Set(category.divisions.map((d: RoleWithDivision) => d.division))],
      })) as CategoryWithStats[];
      console.log('Processed categories data:', data);
    }

    // Update cache
    cache[cacheKey] = {
      data,
      timestamp: now
    };
    console.log(`Updated cache for ${type}`);

    return data;
  } catch (error) {
    console.error(`Error in getCategories(${type}):`, error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    // Return empty array instead of throwing
    return [];
  }
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