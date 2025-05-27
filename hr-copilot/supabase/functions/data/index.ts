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
      case 'getSpecificRole': {
        const response = await getSpecificRole.actionFn({
          supabase: supabaseClient,
          args: {
            roleId: input.roleId,
            includeSkills: input.includeSkills,
            includeCapabilities: input.includeCapabilities,
            includeDocuments: input.includeDocuments
          }
        });
        data = response.data;
        if (!response.success) throw new Error(response.error?.message);
        break;
      }
      case 'getGeneralRoles': {
        const response = await getGeneralRoles.actionFn({
          supabase: supabaseClient,
          args: {
            functionArea: input.functionArea,
            classificationLevel: input.classificationLevel,
            searchTerm: input.searchTerm,
            limit: input.limit,
            offset: input.offset
          }
        });
        data = response.data;
        if (!response.success) throw new Error(response.error?.message);
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