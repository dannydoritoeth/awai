import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../shared/cors.ts';
import { generateCapabilityHeatmapByTaxonomyBase } from '../shared/mcp/actions/generateCapabilityHeatmapByTaxonomy/action.ts';
import { generateCapabilityHeatmapByDivisionBase } from '../shared/mcp/actions/generateCapabilityHeatmapByDivision/action.ts';
import { generateCapabilityHeatmapByRegionBase } from '../shared/mcp/actions/generateCapabilityHeatmapByRegion/action.ts';
import { generateCapabilityHeatmapByCompanyBase } from '../shared/mcp/actions/generateCapabilityHeatmapByCompany/action.ts';
import { summarizeHeatmapData } from '../shared/mcp/actions/utils.ts';
import { getGeneralRoles } from '../shared/mcp/actions/getGeneralRoles/action.ts';
import { getSpecificRole } from '../shared/mcp/actions/getSpecificRole/action.ts';

interface DataRequest {
  insightId: string;
  companyIds?: string[];
  browserSessionId?: string;
  // General roles params
  functionArea?: string;
  classificationLevel?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
  filters?: {
    taxonomies?: string[];
    regions?: string[];
    divisions?: string[];
    employmentTypes?: string[];
    capabilities?: string[];
    skills?: string[];
  };
  // Specific role params
  roleId?: string;
  includeSkills?: boolean;
  includeCapabilities?: boolean;
  includeDocuments?: boolean;
}

interface Category {
  id: string;
  name: string;
  description: string;
  type: 'taxonomy' | 'skill' | 'capability';
  parent_id?: string;
  role_count: number;
  divisions: string[];
}

interface Company {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  created_at: string;
}

interface Division {
  id: string;
  name: string;
  cluster: string;
  agency: string;
}

interface Capability {
  id: string;
  name: string;
  group_name: string;
  description: string | null;
  type: string;
  level: string;
}

interface RoleWithDivision {
  division: string;
}

const actions = {
  getCapabilities: async (supabase: any) => {
    const { data, error } = await supabase
      .from('capabilities')
      .select('*')
      .order('name');

    if (error) throw error;
    return data as Capability[];
  },

  getTaxonomies: async (supabase: any) => {
    const { data, error } = await supabase
      .from('categories')
      .select(`
        *,
        role_count:roles(count),
        divisions:roles(division)
      `)
      .eq('type', 'taxonomy');

    if (error) throw error;
    
    // Process the data to get unique divisions and correct role count
    return data.map((category: any) => ({
      ...category,
      role_count: category.role_count[0]?.count || 0,
      divisions: [...new Set(category.divisions.map((d: RoleWithDivision) => d.division))],
    })) as Category[];
  },

  getCompanies: async (supabase: any, params: { searchTerm?: string; divisions?: string[] } = {}) => {
    let query = supabase
      .from('companies')
      .select('*');

    if (params.searchTerm) {
      query = query.ilike('name', `%${params.searchTerm}%`);
    }

    if (params.divisions?.length) {
      query = query.in('division_id', params.divisions);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Company[];
  },

  getCompany: async (supabase: any, params: { id: string }) => {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    return data as Company;
  },

  getDivisions: async (supabase: any, params: { searchTerm?: string; cluster?: string; agency?: string } = {}) => {
    let query = supabase
      .from('divisions')
      .select('*')
      .order('name');

    if (params.searchTerm) {
      query = query.or(`name.ilike.%${params.searchTerm}%,agency.ilike.%${params.searchTerm}%`);
    }

    if (params.cluster) {
      query = query.eq('cluster', params.cluster);
    }

    if (params.agency) {
      query = query.eq('agency', params.agency);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Division[];
  },

  getDivision: async (supabase: any, params: { id: string }) => {
    const { data, error } = await supabase
      .from('divisions')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    return data as Division;
  }
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { insightId, params } = await req.json();

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the action function
    const actionFn = actions[insightId as keyof typeof actions];
    if (!actionFn) {
      throw new Error(`Action ${insightId} not found`);
    }

    // Execute the action
    const data = await actionFn(supabase, params);

    return new Response(
      JSON.stringify(data),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
}); 