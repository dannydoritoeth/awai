import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { encrypt } from '../_shared/encryption.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { HubspotClient } from '../_shared/hubspotClient.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')!;
const HUBSPOT_CLIENT_ID = Deno.env.get('HUBSPOT_CLIENT_ID')!;
const HUBSPOT_CLIENT_SECRET = Deno.env.get('HUBSPOT_CLIENT_SECRET')!;
const HUBSPOT_REDIRECT_URI = Deno.env.get('HUBSPOT_REDIRECT_URI')!;
const APP_INSTALL_SUCCESS_URI = Deno.env.get('APP_INSTALL_SUCCESS_URI')!;
const APP_INSTALL_FAILED_URI = Deno.env.get('APP_INSTALL_FAILED_URI')!;

const trainingProperties = {
  deals: [
    {
      name: 'training_score',
      label: 'Training Score',
      type: 'number',
      fieldType: 'number',
      description: 'Score this record from 0-100 to indicate how ideal this deal is',
      groupName: 'ai_scoring'
    },
    {
      name: 'training_notes',
      label: 'Training Notes',
      type: 'string',
      fieldType: 'textarea',
      groupName: 'ai_scoring'
    }
  ]
};

const scoringProperties = {
  deals: [
    {
      name: 'ideal_client_score',
      label: 'Ideal Client Score',
      type: 'number',
      fieldType: 'number',
      description: 'AI-generated score indicating how well this deal matches your ideal client profile',
      groupName: 'ai_scoring'
    },
    {
      name: 'ideal_client_summary',
      label: 'Ideal Client Summary',
      type: 'string',
      fieldType: 'textarea',
      description: 'AI-generated analysis of why this deal matches or differs from your ideal client profile',
      groupName: 'ai_scoring'
    },
    {
      name: 'ideal_client_last_scored',
      label: 'Last Scored',
      type: 'datetime',
      fieldType: 'date',
      description: 'When this deal was last analyzed by AI',
      groupName: 'ai_scoring'
    }
  ]
};

async function createHubSpotProperties(accessToken: string) {
  const hubspotClient = new HubspotClient(accessToken);
  let dealGroupCreated = false;

  // Create deal property group
  try {
    await hubspotClient.createPropertyGroup({
      name: 'ai_scoring',
      label: 'AI Scoring',
      displayOrder: 1,
      target: 'deal'
    });
    console.log('Created deal property group: ai_scoring');
    dealGroupCreated = true;
  } catch (error) {
    console.error('Error creating deal property group:', error);
  }

  // Add a small delay to ensure HubSpot has processed the group
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Only create deal properties if the group was created
  if (dealGroupCreated) {
    // Create training properties
    for (const property of trainingProperties.deals) {
      try {
        await hubspotClient.createDealProperty(property);
        console.log(`Created deal training property: ${property.name}`);
      } catch (error) {
        console.error(`Error creating deal training property ${property.name}:`, error);
      }
    }
    // Create scoring properties
    for (const property of scoringProperties.deals) {
      try {
        await hubspotClient.createDealProperty(property);
        console.log(`Created deal scoring property: ${property.name}`);
      } catch (error) {
        console.error(`Error creating deal scoring property ${property.name}:`, error);
      }
    }
  } else {
    console.log('Skipping deal properties as group creation failed');
  }
}

async function exchangeCodeForToken(code: string): Promise<{ access_token: string; refresh_token: string; hub_id: number }> {
  const tokenEndpoint = 'https://api.hubapi.com/oauth/v1/token';
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: HUBSPOT_CLIENT_ID,
    client_secret: HUBSPOT_CLIENT_SECRET,
    redirect_uri: HUBSPOT_REDIRECT_URI,
    code: code
  });

  console.log('Exchanging code for token...');
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Token exchange failed:', error);
    throw new Error(`Failed to exchange code for token: ${error}`);
  }

  const data = await response.json();
  console.log('Token response data:', JSON.stringify(data, null, 2));

  if (!data.access_token) {
    console.error('No access token in response');
    throw new Error('No access token in response');
  }

  if (!data.refresh_token) {
    console.error('No refresh token in response');
    throw new Error('No refresh token in response');
  }

  // Fetch token metadata to get hub ID
  console.log('Fetching token metadata...');
  const metadataResponse = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${data.access_token}`, {
    method: 'GET'
  });

  if (!metadataResponse.ok) {
    const error = await metadataResponse.text();
    console.error('Token metadata fetch failed:', error);
    throw new Error(`Failed to fetch token metadata: ${error}`);
  }

  const metadata = await metadataResponse.json();
  console.log('Token metadata:', JSON.stringify(metadata, null, 2));

  const hubId = metadata.hub_id;
  if (!hubId) {
    console.error('No hub_id in token metadata');
    throw new Error('Failed to get hub ID from token metadata');
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    hub_id: Number(hubId)
  };
}

async function handleOAuth(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    
    if (!code) {
      return redirectToFailure('No authorization code provided');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Exchange code for tokens
    const { access_token, refresh_token, hub_id } = await exchangeCodeForToken(code);

    // Check if this portal already exists
    const { data: existingAccount } = await supabase
      .from('hubspot_accounts')
      .select('id, partner_id')
      .eq('portal_id', hub_id.toString())
      .single();

    // Parse state parameter to get partner_id if provided
    let partnerId: string | null = null;
    if (stateParam) {
      try {
        const state = JSON.parse(stateParam);
        partnerId = state.partner_id;
      } catch (e) {
        console.error('Error parsing state parameter:', e);
      }
    }

    // If partner_id is provided, verify it exists
    if (partnerId) {
      const { data: partner, error: partnerError } = await supabase
        .from('partners')
        .select('id, status')
        .eq('id', partnerId)
        .single();

      if (partnerError || !partner || partner.status !== 'active') {
        return redirectToFailure('Invalid or inactive partner ID');
      }
    }

    // Encrypt tokens
    const encryptedAccessToken = await encrypt(access_token, ENCRYPTION_KEY);
    const encryptedRefreshToken = await encrypt(refresh_token, ENCRYPTION_KEY);

    if (existingAccount) {
      // Update existing account but don't change partner_id if it exists
      const updateData = {
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        status: 'active',
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString() // 6 hours from now
      };

      const { error: updateError } = await supabase
        .from('hubspot_accounts')
        .update(updateData)
        .eq('portal_id', hub_id.toString());

      if (updateError) {
        console.error('Error updating account:', updateError);
        return redirectToFailure('Failed to update account');
      }
    } else {
      // Create new account with partner_id if provided
      const { error: insertError } = await supabase
        .from('hubspot_accounts')
        .insert({
          portal_id: hub_id.toString(),
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          partner_id: partnerId,
          status: 'active',
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString() // 6 hours from now
        });

      if (insertError) {
        console.error('Error creating account:', insertError);
        return redirectToFailure('Failed to create account');
      }
    }

    // Create HubSpot properties
    try {
      await createHubSpotProperties(access_token);
    } catch (error) {
      console.error('Error creating HubSpot properties:', error);
      // Continue despite property creation errors
    }

    // Call hubspot-train-sync and wait for it to complete
    try {
      console.log(`Calling hubspot-train-sync for portal ${hub_id}...`);
      const syncUrl = `${SUPABASE_URL}/functions/v1/hubspot-train-sync?portal_id=${hub_id}`;
      
      const syncResponse = await fetch(syncUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!syncResponse.ok) {
        console.error(`Error from hubspot-train-sync: ${syncResponse.status} ${await syncResponse.text()}`);
      } else {
        console.log(`Successfully synced training objects for portal ${hub_id}`);
      }
    } catch (syncError) {
      console.error('Error calling hubspot-train-sync:', syncError);
      // Continue despite sync errors
    }
    
    // Call hubspot-train-deal-batch without waiting for it to complete
    try {
      console.log(`Initiating hubspot-train-deal-batch...`);
      const batchUrl = `${SUPABASE_URL}/functions/v1/hubspot-train-deal-batch`;
      
      // Fire and forget - don't await
      fetch(batchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Triggered batch training process`);
    } catch (batchError) {
      console.error('Error triggering hubspot-train-deal-batch:', batchError);
      // Continue despite batch errors
    }

    return redirectToSuccess();
  } catch (error) {
    console.error('OAuth error:', error);
    return redirectToFailure(error.message);
  }
}

function redirectToSuccess(): Response {
  return Response.redirect(APP_INSTALL_SUCCESS_URI);
}

function redirectToFailure(error: string): Response {
  const failureUrl = new URL(APP_INSTALL_FAILED_URI);
  failureUrl.searchParams.set('error', error);
  return Response.redirect(failureUrl.toString());
}

serve(handleOAuth);