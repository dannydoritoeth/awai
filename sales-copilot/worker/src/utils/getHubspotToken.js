const { createClient } = require('@supabase/supabase-js');
const Logger = require('../services/logger');

// Initialize logger
const logger = new Logger();

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
            .select('access_token')
            .eq('portal_id', portalId)
            .single();

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        if (!data?.access_token) {
            throw new Error(`No access token found for portal ID: ${portalId}`);
        }

        return data.access_token;
    } catch (error) {
        logger.error('Error getting HubSpot access token:', error);
        throw error;
    }
}

module.exports = getHubspotAccessToken; 