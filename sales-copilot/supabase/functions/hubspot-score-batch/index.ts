import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { HubspotClient } from "../_shared/hubspotClient.ts";
import { ScoringService } from "../_shared/scoringService.ts";
import { Logger } from "../_shared/logger.ts";
import { AIConfig } from "../_shared/types.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

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
      .from('hubspot_accounts')
      .select('*')
      .eq('status', 'active');

    if (error) throw error;

    for (const account of accounts) {
      logger.info(`Processing portal ${account.portal_id}`);

      // Create AI configuration from account settings
      const aiConfig: AIConfig = {
        provider: account.ai_provider,
        model: account.ai_model,
        temperature: account.ai_temperature,
        maxTokens: account.ai_max_tokens,
        scoringPrompt: account.scoring_prompt
      };

      const hubspotClient = new HubspotClient(account.access_token);
      
      // // Validate properties before processing
      // try {
      //   await hubspotClient.validateProperties();
      //   logger.info(`Validated properties for portal ${account.portal_id}`);
      // } catch (error) {
      //   logger.error(`Failed to validate properties for portal ${account.portal_id}:`, error);
      //   // Skip this account if property validation fails
      //   continue;
      // }

      const scoringService = new ScoringService(
        account.access_token, 
        aiConfig, 
        account.portal_id, 
        logger
      );

      // Get last processed timestamp for this portal
      const since = account.last_scoring_run || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Process contacts
      let contactsProcessed = 0;
      let hasMore = true;
      let after: string | null = null;

      while (hasMore) {
        const response = await hubspotClient.searchRecords('contacts', {
          filterGroups: [{
            filters: [{
              propertyName: 'lastmodifieddate',
              operator: 'GTE',
              value: since
            }]
          }],
          limit: BATCH_SIZE,
          after: after || undefined
        });

        for (const contact of response.results) {
          await scoringService.scoreContact(contact.id);
          contactsProcessed++;
        }

        hasMore = response.paging?.next?.after != null;
        after = response.paging?.next?.after || null;
      }

      // Process companies
      let companiesProcessed = 0;
      hasMore = true;
      after = null;

      while (hasMore) {
        const response = await hubspotClient.searchRecords('companies', {
          filterGroups: [{
            filters: [{
              propertyName: 'lastmodifieddate',
              operator: 'GTE',
              value: since
            }]
          }],
          limit: BATCH_SIZE,
          after: after || undefined
        });

        for (const company of response.results) {
          await scoringService.scoreCompany(company.id);
          companiesProcessed++;
        }

        hasMore = response.paging?.next?.after != null;
        after = response.paging?.next?.after || null;
      }

      // Process deals
      let dealsProcessed = 0;
      hasMore = true;
      after = null;

      while (hasMore) {
        const response = await hubspotClient.searchRecords('deals', {
          filterGroups: [{
            filters: [{
              propertyName: 'lastmodifieddate',
              operator: 'GTE',
              value: since
            }]
          }],
          limit: BATCH_SIZE,
          after: after || undefined
        });

        for (const deal of response.results) {
          await scoringService.scoreDeal(deal.id);
          dealsProcessed++;
        }

        hasMore = response.paging?.next?.after != null;
        after = response.paging?.next?.after || null;
      }

      // Update last run time
      await supabase
        .from('hubspot_accounts')
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
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    logger.error('Batch scoring error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}); 