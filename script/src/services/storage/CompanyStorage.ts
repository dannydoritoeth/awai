/**
 * @file CompanyStorage.ts
 * @description Handles all company-related database operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';

export class CompanyStorage {
  constructor(
    private stagingClient: SupabaseClient,
    private liveClient: SupabaseClient,
    private logger: Logger
  ) {}

  /**
   * Store company record in staging
   */
  async storeCompanyRecord(company: { name: string; description: string; website: string; raw_data: any }): Promise<any[]> {
    try {
      if (!company) {
        throw new Error('Company object is required');
      }

      // Ensure we have a valid company name
      const companyName = (company.name || '').trim();
      if (!companyName) {
        throw new Error('Company name is required');
      }

      // First check if company exists
      const { data: existingCompany, error: fetchError } = await this.stagingClient
        .from('companies')
        .select('*')
        .eq('name', companyName)
        .maybeSingle();

      // If company exists, return it
      if (existingCompany) {
        this.logger.info(`Company ${companyName} already exists with id ${existingCompany.id}`);
        return [existingCompany];
      }

      // If error is not PGRST116 (no rows), throw it
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // Company doesn't exist, create it
      const companyData = {
        name: companyName,
        description: company.description || `${companyName} - NSW Government`,
        website: company.website || 'https://www.nsw.gov.au',
        sync_status: 'pending',
        last_synced_at: new Date().toISOString(),
        raw_data: company.raw_data
      };

      const { data, error: insertError } = await this.stagingClient
        .from('companies')
        .insert(companyData)
        .select();

      if (insertError) {
        this.logger.error('Error inserting company:', { error: insertError, company: companyData });
        throw insertError;
      }

      if (!data || data.length === 0) {
        throw new Error('No data returned after company insert');
      }

      this.logger.info(`Successfully inserted company: ${companyName} with id ${data[0].id}`);
      return data;
    } catch (error) {
      this.logger.error('Error storing company record:', error);
      throw error;
    }
  }
} 