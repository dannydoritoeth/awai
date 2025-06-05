/**
 * @file CompanyStorage.ts
 * @description Handles all company-related database operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';
import { CompanyData, CompanyRecord } from './types.js';
import { Pool } from 'pg';

export class CompanyStorage {
  constructor(
    private stagingClient: SupabaseClient,
    private liveClient: SupabaseClient,
    private logger: Logger,
    private pgStagingPool?: Pool
  ) {}

  /**
   * Get existing company by name or create if it doesn't exist
   */
  async getOrCreateCompany(company: CompanyData): Promise<CompanyRecord> {
    this.logger.info(`Getting or creating company ${JSON.stringify(company)}`);
    try {
      if (!company) {
        throw new Error('Company object is required');
      }

      // Ensure we have a valid company name
      const companyName = (company.name || '').trim();
      if (!companyName) {
        throw new Error('Company name is required');
      }

      // Use PostgreSQL pool if available, otherwise fall back to Supabase
      if (this.pgStagingPool) {
        const client = await this.pgStagingPool.connect();
        try {
          // First check if company exists
          const existingCompanyResult = await client.query(
            'SELECT id, name, description, website, raw_data, sync_status, last_synced_at FROM companies WHERE name = $1',
            [companyName]
          );

          // If company exists, return it
          if (existingCompanyResult.rows.length > 0) {
            this.logger.info(`Found existing company ${companyName} with id ${existingCompanyResult.rows[0].id}`);
            return existingCompanyResult.rows[0];
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

          const insertResult = await client.query(
            `INSERT INTO companies 
            (name, description, website, sync_status, last_synced_at, raw_data)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name, description, website, raw_data, sync_status, last_synced_at`,
            [
              companyData.name,
              companyData.description,
              companyData.website,
              companyData.sync_status,
              companyData.last_synced_at,
              companyData.raw_data
            ]
          );

          const newCompany = insertResult.rows[0];
          this.logger.info(`Created new company: ${companyName} with id ${newCompany.id}`);
          return newCompany;
        } finally {
          client.release();
        }
      } else {
        // Fall back to Supabase client
        // First check if company exists
        const { data: existingCompany, error: fetchError } = await this.stagingClient
          .from('companies')
          .select('*')
          .eq('name', companyName)
          .maybeSingle();

        // If company exists, return it
        if (existingCompany) {
          this.logger.info(`Found existing company ${companyName} with id ${existingCompany.id}`);
          return existingCompany;
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
          .select()
          .single();

        if (insertError) {
          this.logger.error('Error inserting company:', { error: insertError, company: companyData });
          throw insertError;
        }

        if (!data) {
          throw new Error('No data returned after company insert');
        }

        this.logger.info(`Created new company: ${companyName} with id ${data.id}`);
        return data;
      }
    } catch (error) {
      this.logger.error('Error in getOrCreateCompany:', error);
      throw error;
    }
  }
} 