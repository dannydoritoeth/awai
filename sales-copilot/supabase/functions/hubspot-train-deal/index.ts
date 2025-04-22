import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import OpenAI from 'https://esm.sh/openai@4.86.1';
import { HubspotClient } from '../_shared/hubspotClient.ts';
import { Logger } from '../_shared/logger.ts';
import { decrypt } from '../_shared/encryption.ts';
import { DocumentPackager } from '../_shared/documentPackager.ts';
import { handleApiCall } from '../_shared/apiHandler.ts';
import { processSingleDeal } from '../_shared/dealProcessor.ts';
import { calculateDealStatistics } from '../_shared/statistics.ts';
import { PineconeClient } from '../_shared/pineconeClient.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { Database } from '../_shared/database.types.ts';
import { Deal } from '../_shared/types.ts';

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const logger = new Logger('hubspot-train-deal');
  try {
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false
        }
      }
    );

    const hubspotClient = new HubspotClient();

    const { dealId } = await req.json();

    if (!dealId) {
      throw new Error('dealId is required');
    }

    // Get deal details from Supabase
    const { data: deal, error: dealError } = await supabaseClient
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .single();

    if (dealError) {
      throw new Error(`Failed to fetch deal: ${dealError.message}`);
    }

    if (!deal) {
      throw new Error(`Deal ${dealId} not found`);
    }

    // Update status to in_progress
    const { error: statusError } = await supabaseClient
      .from('deals')
      .update({ status: 'in_progress' })
      .eq('id', dealId);

    if (statusError) {
      throw new Error(`Failed to update deal status: ${statusError.message}`);
    }

    // Process the deal with retry logic
    let retryCount = 0;
    let lastError = null;

    while (retryCount < MAX_RETRIES) {
      try {
        // Get deal details from HubSpot
        const hubspotDeal = await hubspotClient.getDeal(deal.hubspot_id);
        if (!hubspotDeal) {
          throw new Error('Failed to fetch deal from HubSpot');
        }

        // Get associated contacts
        const contacts = await hubspotClient.getDealContacts(deal.hubspot_id);
        if (!contacts || contacts.length === 0) {
          throw new Error('No contacts found for deal');
        }

        // Get contact details
        const contactDetails = await Promise.all(
          contacts.map(contact => hubspotClient.getContact(contact.id))
        );

        // Get company details
        const companyDetails = await Promise.all(
          contacts
            .filter(contact => contact.associatedCompanyId)
            .map(contact => hubspotClient.getCompany(contact.associatedCompanyId!))
        );

        // Update deal in Supabase with enriched data
        const { error: updateError } = await supabaseClient
          .from('deals')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            data: {
              ...deal.data,
              hubspot_deal: hubspotDeal,
              contacts: contactDetails,
              companies: companyDetails
            }
          })
          .eq('id', dealId);

        if (updateError) {
          throw new Error(`Failed to update deal: ${updateError.message}`);
        }

        return new Response(
          JSON.stringify({ success: true, dealId }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        );
      } catch (error) {
        lastError = error;
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }

    // If we get here, all retries failed
    const { error: errorStatusError } = await supabaseClient
      .from('deals')
      .update({ status: 'error' })
      .eq('id', dealId);

    if (errorStatusError) {
      console.error('Failed to update deal status to error:', errorStatusError);
    }

    throw lastError;
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});