import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';

interface CompanyMatch {
    companyId: string;
    divisionId?: string;
    confidence: number;
}

export class CompanyDetectionService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_KEY!
        );
    }

    async detectCompany(jobData: any): Promise<CompanyMatch | null> {
        const companyName = this.normalizeCompanyName(jobData.company_name);
        
        // Try exact match first
        const exactMatch = await this.findExactMatch(companyName);
        if (exactMatch) {
            return {
                companyId: exactMatch.id,
                divisionId: await this.detectDivision(exactMatch.id, jobData),
                confidence: 1.0
            };
        }

        // Try fuzzy matching
        const fuzzyMatch = await this.findFuzzyMatch(companyName);
        if (fuzzyMatch && fuzzyMatch.confidence > 0.8) {
            return {
                companyId: fuzzyMatch.id,
                divisionId: await this.detectDivision(fuzzyMatch.id, jobData),
                confidence: fuzzyMatch.confidence
            };
        }

        // Create new company if no match found
        const newCompany = await this.createCompany(jobData);
        return {
            companyId: newCompany.id,
            confidence: 1.0
        };
    }

    private normalizeCompanyName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim()
            .replace(/\b(pty|ltd|limited|inc|incorporated|corporation)\b/g, '') // Remove common suffixes
            .trim();
    }

    private async findExactMatch(normalizedName: string): Promise<any> {
        const { data, error } = await this.supabase
            .from('companies')
            .select('*')
            .eq('normalized_name', normalizedName)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            throw error;
        }

        return data;
    }

    private async findFuzzyMatch(normalizedName: string): Promise<any> {
        // Using Postgres's trigram similarity
        const { data, error } = await this.supabase
            .rpc('fuzzy_company_match', {
                company_name: normalizedName,
                similarity_threshold: 0.4
            });

        if (error) throw error;
        
        // Return the best match if any
        return data && data.length > 0 ? data[0] : null;
    }

    private async createCompany(jobData: any): Promise<any> {
        const { data, error } = await this.supabase
            .from('companies')
            .insert({
                name: jobData.company_name,
                normalized_name: this.normalizeCompanyName(jobData.company_name),
                industry: jobData.industry,
                website: jobData.company_website,
                created_by: 'etl_pipeline',
                metadata: {
                    source: jobData.source_id,
                    first_seen: new Date().toISOString()
                }
            })
            .select()
            .single();

        if (error) throw error;
        
        logger.info('Created new company', {
            companyName: jobData.company_name,
            industry: jobData.industry
        });

        return data;
    }

    private async detectDivision(companyId: string, jobData: any): Promise<string | undefined> {
        if (!jobData.department) {
            return undefined;
        }

        // Try to find existing division
        const { data: existingDivision, error: searchError } = await this.supabase
            .from('divisions')
            .select('id')
            .eq('company_id', companyId)
            .eq('name', jobData.department)
            .single();

        if (searchError && searchError.code !== 'PGRST116') {
            throw searchError;
        }

        if (existingDivision) {
            return existingDivision.id;
        }

        // Create new division if not found
        const { data: newDivision, error: createError } = await this.supabase
            .from('divisions')
            .insert({
                company_id: companyId,
                name: jobData.department,
                created_by: 'etl_pipeline'
            })
            .select('id')
            .single();

        if (createError) throw createError;

        logger.info('Created new division', {
            companyId,
            divisionName: jobData.department
        });

        return newDivision.id;
    }
} 