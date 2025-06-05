/**
 * @file CompanyStorage.ts
 * @description Handles all company-related database operations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils/logger.js';
import { CompanyData, CompanyRecord } from './types.js';
import { Pool } from 'pg';
import { InstitutionStorage } from './InstitutionStorage.js';

export class CompanyStorage {
  private institutions: InstitutionStorage;

  constructor(
    private stagingClient: SupabaseClient,
    private liveClient: SupabaseClient,
    private logger: Logger,
    private pgStagingPool?: Pool
  ) {
    this.institutions = new InstitutionStorage(stagingClient, liveClient, logger);
  }

  /**
   * Convert a string to a URL-friendly slug
   */
  private createSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .substring(0, 100); // Limit length
  }

  /**
   * Get existing company by name or create if it doesn't exist
   */
  async getOrCreateCompany(company: CompanyData): Promise<CompanyRecord> {
    this.logger.info(`Getting or creating company ${company.name}`);
    try {
      if (!company) {
        throw new Error('Company object is required');
      }

      // Ensure we have a valid company name
      const companyName = (company.name || '').trim();
      if (!companyName) {
        throw new Error('Company name is required');
      }

      // Create slug from name
      const slug = this.createSlug(companyName);
      
      // Get or create the institution
      const institutionId = await this.institutions.getOrCreateInstitution();

      // Use PostgreSQL pool if available, otherwise fall back to Supabase
      if (this.pgStagingPool) {
        const client = await this.pgStagingPool.connect();
        try {
          await client.query('BEGIN');

          // First check if company exists - use FOR UPDATE to lock the row
          const existingCompanyResult = await client.query(
            'SELECT id, name, description, website, raw_data, sync_status, last_synced_at FROM companies WHERE institution_id = $1 AND slug = $2 FOR UPDATE',
            [institutionId, slug]
          );

          // If company exists, return it
          if (existingCompanyResult.rows.length > 0) {
            await client.query('COMMIT');
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
            raw_data: company.raw_data,
            institution_id: institutionId,
            slug: slug
          };

          const insertResult = await client.query(
            `INSERT INTO companies 
            (name, description, website, sync_status, last_synced_at, raw_data, institution_id, slug)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (institution_id, slug) DO UPDATE 
            SET name = EXCLUDED.name,
                description = EXCLUDED.description,
                website = EXCLUDED.website,
                sync_status = EXCLUDED.sync_status,
                last_synced_at = EXCLUDED.last_synced_at,
                raw_data = EXCLUDED.raw_data
            RETURNING id, name, description, website, raw_data, sync_status, last_synced_at`,
            [
              companyData.name,
              companyData.description,
              companyData.website,
              companyData.sync_status,
              companyData.last_synced_at,
              companyData.raw_data,
              companyData.institution_id,
              companyData.slug
            ]
          );

          await client.query('COMMIT');
          const newCompany = insertResult.rows[0];
          this.logger.info(`Created new company: ${companyName} with id ${newCompany.id}`);
          return newCompany;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }

      // Fall back to Supabase client
      // Use upsert with ON CONFLICT to handle race conditions
      const { data, error } = await this.stagingClient
        .from('companies')
        .upsert({
          name: companyName,
          description: company.description || `${companyName} - NSW Government`,
          website: company.website || 'https://www.nsw.gov.au',
          sync_status: 'pending',
          last_synced_at: new Date().toISOString(),
          raw_data: company.raw_data,
          institution_id: institutionId,
          slug: slug
        }, {
          onConflict: 'institution_id,slug',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Error upserting company:', { error, company });
        throw error;
      }

      if (!data) {
        throw new Error('No data returned after company upsert');
      }

      this.logger.info(`Upserted company: ${companyName} with id ${data.id}`);
      return data;
    } catch (error) {
      this.logger.error('Error in getOrCreateCompany:', error);
      throw error;
    }
  }
} 