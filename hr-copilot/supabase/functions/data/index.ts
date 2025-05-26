import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../shared/cors.ts';
import { generateCapabilityHeatmapByTaxonomyBase } from '../shared/mcp/actions/generateCapabilityHeatmapByTaxonomy/action.ts';
import { generateCapabilityHeatmapByDivisionBase } from '../shared/mcp/actions/generateCapabilityHeatmapByDivision/action.ts';
import { generateCapabilityHeatmapByRegionBase } from '../shared/mcp/actions/generateCapabilityHeatmapByRegion/action.ts';
import { generateCapabilityHeatmapByCompanyBase } from '../shared/mcp/actions/generateCapabilityHeatmapByCompany/action.ts';
import { summarizeHeatmapData } from '../shared/mcp/actions/utils.ts';

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
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get request body
    const input: DataRequest = await req.json();

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Execute insight query
    let data;
    switch (input.insightId) {
      case 'getGeneralRoles': {
        let query = supabaseClient
          .from('general_roles')
          .select('*');

        // Apply filters
        if (input.functionArea) {
          query = query.eq('function_area', input.functionArea);
        }
        if (input.classificationLevel) {
          query = query.eq('classification_level', input.classificationLevel);
        }
        if (input.searchTerm) {
          query = query.textSearch('search_vector', input.searchTerm);
        }

        // Add pagination
        if (input.limit) {
          query = query.limit(input.limit);
        }
        if (typeof input.offset === 'number') {
          query = query.range(
            input.offset,
            input.offset + (input.limit || 10) - 1
          );
        }

        // Default ordering
        query = query.order('title', { ascending: true });

        const { data: roles, error } = await query;
        if (error) throw error;
        data = roles;
        break;
      }
      case 'generateCapabilityHeatmapByTaxonomy':
        if (!input.companyIds?.length) throw new Error('At least one companyId is required');
        data = await generateCapabilityHeatmapByTaxonomyBase(supabaseClient, input.companyIds);
        break;
      case 'generateCapabilityHeatmapByDivision':
        if (!input.companyIds?.length) throw new Error('At least one companyId is required');
        data = await generateCapabilityHeatmapByDivisionBase(supabaseClient, input.companyIds);
        break;
      case 'generateCapabilityHeatmapByRegion':
        if (!input.companyIds?.length) throw new Error('At least one companyId is required');
        data = await generateCapabilityHeatmapByRegionBase(supabaseClient, input.companyIds);
        break;
      case 'generateCapabilityHeatmapByCompany':
        if (!input.companyIds?.length) throw new Error('At least one companyId is required');
        data = await generateCapabilityHeatmapByCompanyBase(supabaseClient, input.companyIds);
        break;
      default:
        throw new Error(`Unsupported insight: ${input.insightId}`);
    }

    // Get both raw and summarized data for heatmaps
    const response = input.insightId.startsWith('generateCapabilityHeatmap') 
      ? {
          raw: data,
          summarized: summarizeHeatmapData(data)
        }
      : data;

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data: response,
        error: null
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: error.message
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      }
    );
  }
}); 