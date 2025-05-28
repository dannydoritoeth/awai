import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../shared/cors.ts';

interface RoleWithDivision {
  division: string;
}

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

const actions = {
  getCapabilities: async (supabase: any) => {
    const { data, error } = await supabase
      .from('capabilities')
      .select('*')
      .order('name');

    if (error) throw error;
    return data as Capability[];
  },

  getCapability: async (supabase: any, params: { id: string }) => {
    const { data: capability, error } = await supabase
      .from('capabilities')
      .select(`
        *,
        role_capabilities!inner (
          role:roles!inner(id, title),
          level
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) throw error;

    // Transform the data to include roles that require this capability
    const roles = capability.role_capabilities.map((rc: any) => ({
      id: rc.role.id,
      title: rc.role.title,
      required_level: rc.level
    }));

    // Remove the nested data from the response
    const { role_capabilities, ...capabilityData } = capability;

    return {
      ...capabilityData,
      roles
    };
  },

  getRegions: async (supabase: any) => {
    const { data, error } = await supabase
      .from('regions')
      .select('id, name')
      .order('name');

    if (error) throw error;
    return data.map((row: any) => ({ id: row.id, label: row.name }));
  },

  getDivisions: async (supabase: any, params?: { searchTerm?: string }) => {
    console.log('Getting divisions with params:', params);
    
    let query = supabase
      .from('divisions')
      .select('*')
      .order('name');

    if (params?.searchTerm) {
      query = query.ilike('name', `%${params.searchTerm}%`);
    }

    const { data, error } = await query;
    console.log('Divisions query result:', { data: data?.length || 0, error });
    
    if (error) throw error;
    return data;
  },

  getEmploymentTypes: async (supabase: any) => {
    const { data, error } = await supabase
      .from('employment_types')
      .select('id, name')
      .order('name');

    if (error) throw error;
    return data.map((row: any) => ({ id: row.id, label: row.name }));
  },

  getTaxonomies: async (supabase: any, params?: { searchTerm?: string; taxonomyType?: string }) => {
    let query = supabase
      .from('taxonomy')
      .select('*')
      .order('name');

    if (params?.searchTerm) {
      query = query.ilike('name', `%${params.searchTerm}%`);
    }

    if (params?.taxonomyType) {
      query = query.eq('taxonomy_type', params.taxonomyType);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Map the data to match the expected format
    return data.map((taxonomy: any) => ({
      id: taxonomy.id,
      name: taxonomy.name,
      description: taxonomy.description,
      taxonomy_type: taxonomy.taxonomy_type,
      created_at: taxonomy.created_at,
      updated_at: taxonomy.updated_at,
      role_count: 0,
      divisions: []
    }));
  },

  getTaxonomy: async (supabase: any, params: { id: string }) => {
    const { data, error } = await supabase
      .from('taxonomy')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    // Map the data to match the expected format
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      taxonomy_type: data.taxonomy_type,
      created_at: data.created_at,
      updated_at: data.updated_at,
      role_count: 0,
      divisions: []
    };
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

  getDivision: async (supabase: any, params: { id: string }) => {
    const { data, error } = await supabase
      .from('divisions')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    return data as Division;
  },

  getInstitutions: async (supabase: any, params?: { searchTerm?: string }) => {
    let query = supabase
      .from('institutions')
      .select(`
        *,
        companies:companies (
          id,
          name,
          description,
          divisions:divisions (
            id,
            name,
            cluster,
            agency
          )
        )
      `)
      .order('name');

    if (params?.searchTerm) {
      query = query.ilike('name', `%${params.searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data.map((institution: any) => ({
      ...institution,
      company_count: institution.companies?.length || 0,
      division_count: institution.companies?.reduce((acc: number, company: any) => 
        acc + (company.divisions?.length || 0), 0) || 0,
      companies: undefined // Remove nested data from response
    }));
  },

  getInstitution: async (supabase: any, params: { id: string }) => {
    const { data, error } = await supabase
      .from('institutions')
      .select(`
        *,
        companies:companies (
          id,
          name,
          description,
          divisions:divisions (
            id,
            name,
            cluster,
            agency
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) throw error;
    return data;
  }
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log('Edge Function Request:', requestBody);

    const { insightId, params } = requestBody;

    if (!insightId) {
      throw new Error('insightId is required');
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the action function
    const actionFn = actions[insightId as keyof typeof actions];
    if (!actionFn) {
      console.error(`Action not found: ${insightId}`);
      throw new Error(`Action ${insightId} not found`);
    }

    // Execute the action
    const data = await actionFn(supabase, params);
    console.log('Edge Function Response:', data);

    return new Response(
      JSON.stringify({ data }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
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