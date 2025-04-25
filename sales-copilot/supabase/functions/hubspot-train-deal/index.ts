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
import { Deal } from '../_shared/types.ts';

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const logger = new Logger('hubspot-train-deal');
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Get objectId from query parameters
    const url = new URL(req.url);
    const objectId = url.searchParams.get('object_id');

    if (!objectId) {
      throw new Error('object_id is required as a query parameter');
    }

    // Get deal status from hubspot_object_status table
    const { data: dealStatus, error: statusError } = await supabaseClient
      .from('hubspot_object_status')
      .select('*')
      .eq('object_id', objectId)
      .eq('object_type', 'deal')
      .single();

    if (statusError) {
      throw new Error(`Failed to fetch deal status: ${statusError.message}`);
    }

    if (!dealStatus) {
      throw new Error(`Deal ${objectId} not found in hubspot_object_status`);
    }

    // Get HubSpot account details
    const { data: hubspotAccount, error: hsAccountError } = await supabaseClient
      .from('hubspot_accounts')
      .select('access_token, refresh_token, expires_at')
      .eq('portal_id', dealStatus.portal_id)
      .single();

    if (hsAccountError) {
      throw new Error(`Failed to get HubSpot account: ${hsAccountError.message}`);
    }

    if (!hubspotAccount) {
      throw new Error('HubSpot account not found');
    }

    // Decrypt tokens
    const accessToken = await decrypt(hubspotAccount.access_token, Deno.env.get('ENCRYPTION_KEY')!);
    const refreshToken = await decrypt(hubspotAccount.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);

    // Initialize HubSpot client
    const hubspotClient = new HubspotClient(accessToken);

    // Update status to in_progress
    const { error: updateError } = await supabaseClient
      .from('hubspot_object_status')
      .update({ 
        training_status: 'in_progress',
        training_date: new Date().toISOString()
      })
      .eq('object_id', objectId)
      .eq('object_type', 'deal')
      .eq('portal_id', dealStatus.portal_id);

    if (updateError) {
      throw new Error(`Failed to update deal status: ${updateError.message}`);
    }

    // Process the deal with retry logic
    let retryCount = 0;
    let lastError = null;

    while (retryCount < MAX_RETRIES) {
      try {
        // Get deal details from HubSpot
        const hubspotDeal = await handleApiCall(
          hubspotClient,
          dealStatus.portal_id,
          refreshToken,
          () => hubspotClient.getDeal(objectId)
        );

        if (!hubspotDeal) {
          throw new Error('Failed to fetch deal from HubSpot');
        }

        // Get associated contacts and companies
        const associations = await handleApiCall(
          hubspotClient,
          dealStatus.portal_id,
          refreshToken,
          () => hubspotClient.getDealAssociations(objectId)
        );
        const contacts = associations.results['contacts'] || [];
        const companies = associations.results['companies'] || [];
        
        if (!contacts || contacts.length === 0) {
          throw new Error('No contacts found for deal');
        }

        // Get contact details
        const contactDetails = await Promise.all(
          contacts.map(contact => handleApiCall(
            hubspotClient,
            dealStatus.portal_id,
            refreshToken,
            () => hubspotClient.getContact(contact.id)
          ))
        );

        // Get company details from both sources
        const companyDetails = await Promise.all([
          // Get companies associated with contacts
          ...contacts
            .filter(contact => contact.associatedCompanyId)
            .map(contact => handleApiCall(
              hubspotClient,
              dealStatus.portal_id,
              refreshToken,
              () => hubspotClient.getCompany(contact.associatedCompanyId!)
            )),
          // Get companies directly associated with the deal
          ...companies.map(company => handleApiCall(
            hubspotClient,
            dealStatus.portal_id,
            refreshToken,
            () => hubspotClient.getCompany(company.id)
          ))
        ]);

        // Record training event
        const { error: eventError } = await supabaseClient
          .from('ai_events')
          .insert({
            portal_id: dealStatus.portal_id,
            event_type: 'train',
            object_type: 'deal',
            object_id: objectId,
            classification: 'deal',
            document_data: {
              hubspot_deal: hubspotDeal,
              contacts: contactDetails,
              companies: companyDetails
            },
            created_at: new Date().toISOString()
          });

        if (eventError) {
          throw new Error(`Failed to record training event: ${eventError.message}`);
        }

        // Update status to completed
        const { error: completeError } = await supabaseClient
          .from('hubspot_object_status')
          .update({ 
            training_status: 'completed',
            training_date: new Date().toISOString()
          })
          .eq('object_id', objectId)
          .eq('object_type', 'deal')
          .eq('portal_id', dealStatus.portal_id);

        if (completeError) {
          throw new Error(`Failed to update deal status: ${completeError.message}`);
        }

        return new Response(
          JSON.stringify({ success: true, objectId }),
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
      .from('hubspot_object_status')
      .update({ 
        training_status: 'failed',
        training_error: lastError?.message || 'Unknown error',
        training_date: new Date().toISOString()
      })
      .eq('object_id', objectId)
      .eq('object_type', 'deal')
      .eq('portal_id', dealStatus.portal_id);

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