import OpenAI from 'openai';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';

interface TaxonomyClassification {
    roleTitle: string;
    taxonomyGroups: string[];
}

interface TaxonomyResponse {
    classifications: TaxonomyClassification[];
}

export class TaxonomyService {
    private openai: OpenAI;
    private supabase: SupabaseClient;

    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_KEY!
        );
    }

    async generateTaxonomies(jobData: any): Promise<string[]> {
        try {
            const roleTitle = jobData.title;
            const classification = await this.classifyRole(roleTitle);
            return classification.taxonomyGroups;
        } catch (error) {
            logger.error('Error generating taxonomies', {
                error: error instanceof Error ? error.message : String(error),
                jobData
            });
            return [];
        }
    }

    async updateJobTaxonomies(jobId: string, taxonomies: string[]): Promise<void> {
        try {
            // First, remove existing taxonomies
            await this.supabase
                .from('job_taxonomies')
                .delete()
                .eq('job_id', jobId);

            // Then create new taxonomy links
            await this.createJobTaxonomies(jobId, taxonomies);
        } catch (error) {
            logger.error('Error updating job taxonomies', {
                error: error instanceof Error ? error.message : String(error),
                jobId,
                taxonomies
            });
        }
    }

    async createJobTaxonomies(jobId: string, taxonomies: string[]): Promise<void> {
        try {
            // Get or create taxonomy records
            const taxonomyIds = await Promise.all(
                taxonomies.map(async (taxonomyName) => {
                    const { data: existing } = await this.supabase
                        .from('taxonomies')
                        .select('id')
                        .eq('name', taxonomyName)
                        .single();

                    if (existing) {
                        return existing.id;
                    }

                    const { data: created } = await this.supabase
                        .from('taxonomies')
                        .insert({
                            name: taxonomyName,
                            description: `Roles related to ${taxonomyName.toLowerCase()}`,
                            taxonomy_type: 'core'
                        })
                        .select('id')
                        .single();

                    if (!created) {
                        throw new Error(`Failed to create taxonomy: ${taxonomyName}`);
                    }

                    return created.id;
                })
            );

            // Create job-taxonomy links
            const links = taxonomyIds.map(taxonomyId => ({
                job_id: jobId,
                taxonomy_id: taxonomyId
            }));

            await this.supabase
                .from('job_taxonomies')
                .insert(links);

        } catch (error) {
            logger.error('Error creating job taxonomies', {
                error: error instanceof Error ? error.message : String(error),
                jobId,
                taxonomies
            });
        }
    }

    private async classifyRole(roleTitle: string): Promise<TaxonomyClassification> {
        const systemPrompt = `You are an expert in public sector workforce structure and job architecture. Your task is to classify job titles into high-level role taxonomy groups, such as "Policy", "Field Operations", "Legal", "Project Delivery", "Scientific & Technical", or similar categories commonly used in government talent frameworks. Group roles based on their function, not just keywords.`;

        const suggestedTaxonomies = `
Policy
Field Operations
Project Delivery
Legal
Environmental Science
ICT & Digital
HR & Workforce
Finance
Procurement & Contracts
Executive & Leadership
Customer Service
Administrative Support`;

        const userPrompt = `Please classify this role title into suitable taxonomy groups (1-2 groups):

${suggestedTaxonomies}

Return ONLY a valid JSON object with this exact structure:
{
  "classifications": [
    {
      "roleTitle": "${roleTitle}",
      "taxonomyGroups": ["primary group", "optional secondary group"]
    }
  ]
}

Role title to classify:
${roleTitle}`;

        const completion = await this.openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: userPrompt
                }
            ]
        });

        const response = JSON.parse(completion.choices[0].message.content) as TaxonomyResponse;
        return response.classifications[0];
    }
} 