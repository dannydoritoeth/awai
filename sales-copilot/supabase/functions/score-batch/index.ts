import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { HubspotClient } from "./src/services/hubspotClient.ts";
import { ScoringService } from "./src/services/scoringService.ts";
import { Logger } from "./src/utils/logger.ts";

const BATCH_SIZE = 100; // Process 100 records at a time
const logger = new Logger("score-batch");

serve(async (req) => {
  try {
    // Get the last run time from Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all active HubSpot accounts
    const { data: accounts, error } = await supabase
      .from('hubspot_tokens')
      .select('*');

    if (error) throw error;

    for (const account of accounts) {
      logger.info(`Processing portal ${account.portal_id}`);
      const hubspotClient = new HubspotClient(account.access_token);
      const scoringService = new ScoringService(account.access_token);

      // Get last processed timestamp for this portal
      const since = account.last_scoring_run || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Process contacts
      let contactsProcessed = 0;
      let hasMore = true;
      let after = undefined;

      while (hasMore) {
        const response = await hubspotClient.searchContacts({
          filterGroups: [{
            filters: [{
              propertyName: 'lastmodifieddate',
              operator: 'GTE',
              value: since
            }]
          }],
          limit: BATCH_SIZE,
          after
        });

        for (const contact of response.results) {
          await scoringService.scoreContact(contact.id);
          contactsProcessed++;
        }

        hasMore = response.paging?.next?.after != null;
        after = response.paging?.next?.after;
      }

      // Process companies
      let companiesProcessed = 0;
      hasMore = true;
      after = undefined;

      while (hasMore) {
        const response = await hubspotClient.searchCompanies({
          filterGroups: [{
            filters: [{
              propertyName: 'lastmodifieddate',
              operator: 'GTE',
              value: since
            }]
          }],
          limit: BATCH_SIZE,
          after
        });

        for (const company of response.results) {
          await scoringService.scoreCompany(company.id);
          companiesProcessed++;
        }

        hasMore = response.paging?.next?.after != null;
        after = response.paging?.next?.after;
      }

      // Process deals
      let dealsProcessed = 0;
      hasMore = true;
      after = undefined;

      while (hasMore) {
        const response = await hubspotClient.searchDeals({
          filterGroups: [{
            filters: [{
              propertyName: 'lastmodifieddate',
              operator: 'GTE',
              value: since
            }]
          }],
          limit: BATCH_SIZE,
          after
        });

        for (const deal of response.results) {
          await scoringService.scoreDeal(deal.id);
          dealsProcessed++;
        }

        hasMore = response.paging?.next?.after != null;
        after = response.paging?.next?.after;
      }

      // Update last run time
      await supabase
        .from('hubspot_tokens')
        .update({ 
          last_scoring_run: new Date().toISOString(),
          last_scoring_counts: {
            contacts: contactsProcessed,
            companies: companiesProcessed,
            deals: dealsProcessed
          }
        })
        .eq('portal_id', account.portal_id);

      logger.info(`Processed for portal ${account.portal_id}:`, {
        contacts: contactsProcessed,
        companies: companiesProcessed,
        deals: dealsProcessed
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    logger.error('Batch scoring error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}); 