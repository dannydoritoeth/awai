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
  companyIds: string[];
  browserSessionId?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get request body
    const input: DataRequest = await req.json();

    // Validate input
    if (!input.insightId) {
      throw new Error('insightId is required');
    }
    if (!input.companyIds || !input.companyIds.length) {
      throw new Error('At least one companyId is required');
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Execute insight query
    let data;
    switch (input.insightId) {
      case 'generateCapabilityHeatmapByTaxonomy':
        data = await generateCapabilityHeatmapByTaxonomyBase(supabaseClient, input.companyIds);
        break;
      case 'generateCapabilityHeatmapByDivision':
        data = await generateCapabilityHeatmapByDivisionBase(supabaseClient, input.companyIds);
        break;
      case 'generateCapabilityHeatmapByRegion':
        data = await generateCapabilityHeatmapByRegionBase(supabaseClient, input.companyIds);
        break;
      case 'generateCapabilityHeatmapByCompany':
        data = await generateCapabilityHeatmapByCompanyBase(supabaseClient, input.companyIds);
        break;
      default:
        throw new Error(`Unsupported insight: ${input.insightId}`);
    }

    // Get both raw and summarized data
    const summarizedData = summarizeHeatmapData(data);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          raw: data,
          summarized: summarizedData
        },
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