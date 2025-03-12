const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const querystring = require('querystring');
const Logger = require('../services/logger');

// Initialize logger
const logger = new Logger();

async function refreshHubspotToken(refreshToken) {
    try {
        if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_CLIENT_SECRET) {
            throw new Error('HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET must be set for OAuth authentication');
        }

        const response = await axios.post('https://api.hubapi.com/oauth/v1/token', 
            querystring.stringify({
                grant_type: 'refresh_token',
                client_id: process.env.HUBSPOT_CLIENT_ID,
                client_secret: process.env.HUBSPOT_CLIENT_SECRET,
                refresh_token: refreshToken
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        return {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expires_in: response.data.expires_in
        };
    } catch (error) {
        logger.error('Error refreshing HubSpot token:', error);
        if (error.response) {
            logger.error('Error response data:', error.response.data);
            logger.error('Error response status:', error.response.status);
        }
        throw error;
    }
}

async function getHubspotAccessToken(portalId) {
    try {
        // Initialize Supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );

        // Query the hubspot_accounts table
        const { data, error } = await supabase
            .from('hubspot_accounts')
            .select('access_token, refresh_token, expires_at')
            .eq('portal_id', portalId)
            .single();

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        if (!data) {
            throw new Error(`No access token found for portal ID: ${portalId}. The user needs to authorize the app first.`);
        }

        // Check if token is expired or will expire in the next 5 minutes
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

        if (expiresAt <= new Date(now.getTime() + fiveMinutes)) {
            logger.info('Access token expired or expiring soon, refreshing...');
            
            // Refresh the token
            const newTokens = await refreshHubspotToken(data.refresh_token);
            
            // Update the database with new tokens
            const { error: updateError } = await supabase
                .from('hubspot_accounts')
                .update({
                    access_token: newTokens.access_token,
                    refresh_token: newTokens.refresh_token,
                    expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('portal_id', portalId);

            if (updateError) {
                throw new Error(`Failed to update tokens: ${updateError.message}`);
            }

            return newTokens.access_token;
        }

        return data.access_token;
    } catch (error) {
        logger.error('Error getting HubSpot access token:', error);
        throw error;
    }
}

module.exports = getHubspotAccessToken; 