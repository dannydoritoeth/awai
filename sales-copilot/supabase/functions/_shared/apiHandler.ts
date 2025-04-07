import { HubspotClient } from './hubspotClient.ts';
import { encrypt } from './encryption.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

/**
 * Handles API calls with automatic token refresh
 * @param client HubSpot client instance
 * @param portalId HubSpot portal ID
 * @param refreshToken Refresh token for the portal
 * @param apiCall Function that makes the actual API call
 * @returns Result of the API call
 */
export async function handleApiCall<T>(
  client: HubspotClient,
  portalId: string,
  refreshToken: string,
  apiCall: () => Promise<T>
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    if (error.response?.status === 401 || (error.status === 401)) {
      // Token expired, refresh and retry
      const newTokens = await client.refreshToken(
        refreshToken,
        Deno.env.get('HUBSPOT_CLIENT_ID')!,
        Deno.env.get('HUBSPOT_CLIENT_SECRET')!
      );
      
      if (!newTokens.access_token || !newTokens.refresh_token) {
        throw new Error('Failed to refresh tokens');
      }

      // Update tokens in database
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const encryptedAccessToken = await encrypt(newTokens.access_token, Deno.env.get('ENCRYPTION_KEY')!);
      const encryptedRefreshToken = await encrypt(newTokens.refresh_token, Deno.env.get('ENCRYPTION_KEY')!);

      await supabase
        .from('hubspot_accounts')
        .update({
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('portal_id', portalId);

      // Update client with new token and retry
      client.setToken(newTokens.access_token);
      return await apiCall();
    }
    throw error;
  }
} 