import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';
import { DocumentProcessor } from "../utils/documentProcessor.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenAI } from 'openai';

const JobSchema = z.object({
    title: z.string(),
    department: z.string(),
    subDepartment: z.string().nullable().optional(),
    location: z.string(),
    salary: z.string(),
    closingDate: z.string(),
    jobId: z.string(),
    sourceUrl: z.string(),
    institution: z.string(),
    source: z.string(),
    details: z.object({
        documents: z.array(z.any())
    }).optional()
});

type Department = {
    name: string;
    jobs: z.infer<typeof JobSchema>[];
};

type StagedJobRawData = {
    title: string;
    department: string;
    department_name: string;
    location: string;
    close_date: string;
    remuneration: string;
    source_url: string;
    raw_job: z.infer<typeof JobSchema>;
};

type StagedJob = {
    id: number;
    institution_id: string;
    source_id: string;
    original_id: string;
    raw_data: StagedJobRawData;
    processed: boolean;
    processing_metadata?: Record<string, any>;
    validation_status: string;
    validation_timestamp?: string;
    validation_errors?: Record<string, any>;
};

interface JobDetails {
    title: string;
    department: string;
    department_name?: string;
    location: string;
    salary: string;
    closingDate: string;
    jobId: string;
    sourceUrl: string;
    jobType: string;
    source: string;
    institution: string;
    details?: {
        description?: string;
        documents?: Array<{
            url: string;
            text: string;
            type: string;
        }>;
    };
}

interface CapabilityData {
    name: string;
    description?: string;
    level?: string;
    behavioral_indicators?: string[];
}

interface SkillData {
    name: string;
    description?: string;
    context?: string;
}

interface ExtractedAnalysis {
    capabilities: CapabilityData[];
    skills: SkillData[];
}

export class ETLProcessor {
    #name = "nsw gov jobs";
    #supabase: SupabaseClient;
    #documentProcessor: DocumentProcessor;
    #institutionId: string;
    #openai: OpenAI;

    constructor({ maxJobs = 10, supabase, institution_id }: { maxJobs?: number; supabase: SupabaseClient; institution_id: string }) {
        if (!supabase) {
            throw new Error('Supabase client is required');
        }
        this.#supabase = supabase;
        this.#institutionId = institution_id;

        // Initialize OpenAI
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is required for content processing');
        }
        this.#openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.#documentProcessor = new DocumentProcessor();
    }

    async processInstitution(institutionId: string, departments: Department[]) {
        logger.info(`Processing institution ${institutionId}`);

        try {
            // First, stage all jobs
            const stagedJobs = await this.#stageJobs(departments, institutionId);
            logger.info(`Successfully staged ${stagedJobs} jobs`);

            // Process any documents from the jobs
            await this.#processDocuments(departments, institutionId);

            // Then process staged jobs into final tables
            await this.#processStaged(institutionId);

        } catch (error) {
            logger.error('Error processing institution:', { error });
            throw error;
        }
    }

    async #processDocuments(departments: Department[], institutionId: string) {
        logger.info('Processing job documents...');
        let totalDocuments = 0;

        for (const dept of departments) {
            for (const job of dept.jobs) {
                if (job.details?.documents?.length) {
                    try {
                        // Get documents from staging_documents table
                        const { data: stagedDocs, error } = await this.#supabase
                            .from('staging_documents')
                            .select('*')
                            .eq('institution_id', institutionId)
                            .eq('metadata->>jobId', job.jobId)
                            .eq('processing_status', 'pending');

                        if (error) {
                            throw error;
                        }

                        if (stagedDocs?.length) {
                            totalDocuments += stagedDocs.length;
                            
                            // Update processing status
                            await this.#supabase
                                .from('staging_documents')
                                .update({ 
                                    processing_status: 'processed',
                                    processed_at: new Date().toISOString()
                                })
                                .eq('institution_id', institutionId)
                                .eq('metadata->>jobId', job.jobId);
                        }
                    } catch (error) {
                        logger.error(`Error processing documents for job ${job.jobId}:`, { error });
                    }
                }
            }
        }

        logger.info(`Processed ${totalDocuments} documents`);
    }

    async #stageJobs(departments: Department[], institutionId: string): Promise<number> {
        let stagedCount = 0;

        // Create a batch for staging
        const stagingBatch = departments.flatMap(dept => 
            dept.jobs.map(job => ({
                institution_id: institutionId,
                source_id: job.source,
                original_id: job.jobId,
                raw_data: {
                    title: job.title,
                    department: job.department,
                    department_name: dept.name,
                    location: job.location,
                    close_date: job.closingDate,
                    remuneration: job.salary,
                    source_url: job.sourceUrl,
                    raw_job: job
                },
                validation_status: 'pending',
                processed: false,
                processing_metadata: {}
            }))
        );

        // Upsert into staging table - let external_id be generated
        const { data, error } = await this.#supabase
            .from('staging_jobs')
            .upsert(stagingBatch)
            .select();

        if (error) {
            logger.error('Error staging jobs:', { error });
            throw error;
        }

        return data?.length || 0;
    }

    async #processStaged(institutionId: string) {
        logger.info(`Processing staged jobs for institution ${institutionId}`);

        try {
            // First process companies
            await this.#processStageCompanies(institutionId);
            
            // Then process jobs
            await this.#processStagedJobs(institutionId);

            // Clear processed staging data
            await this.#clearStaged(institutionId);

        } catch (error) {
            logger.error('Error processing staged data:', { error });
            throw error;
        }
    }

    async #processStageCompanies(institutionId: string) {
        // Get unique companies from staging
        const { data: stagedCompanies, error } = await this.#supabase
            .from('staging_jobs')
            .select('raw_data')
            .eq('institution_id', institutionId);

        if (error) throw error;

        // Get unique department names from raw_data
        const departmentNames = [...new Set(
            stagedCompanies
                ?.map(job => (job.raw_data as StagedJobRawData)?.department_name)
                .filter(Boolean) || []
        )];

        for (const departmentName of departmentNames) {
            await this.#getOrCreateCompany({
                name: departmentName,
                institutionId
            });
        }
    }

    async #processStagedJobs(institutionId: string) {
        // Process in batches to avoid timeout
        const batchSize = 100;
        let processed = 0;
        
        while (true) {
            const { data: batch, error } = await this.#supabase
                .from('staging_jobs')
                .select('*')
                .eq('institution_id', institutionId)
                .eq('processed', false)
                .limit(batchSize);

            if (error) throw error;
            if (!batch?.length) break;

            for (const stagedJob of batch) {
                try {
                    // Log the raw data for debugging
                    logger.info('Processing staged job:', {
                        jobId: stagedJob.original_id,
                        department: stagedJob.raw_data.department_name
                    });

                    const companyId = await this.#getOrCreateCompany({
                        name: stagedJob.raw_data.department_name || 'NSW Government',
                        institutionId
                    });

                    const { data: existingJob } = await this.#supabase
                        .from('jobs')
                        .select('id, version')
                        .eq('company_id', companyId)
                        .eq('source_id', stagedJob.source_id)
                        .eq('original_id', stagedJob.original_id)
                        .single();

                    if (existingJob) {
                        await this.#updateJob(existingJob.id, stagedJob, companyId);
                    } else {
                        await this.#createJob(stagedJob, companyId);
                    }

                    // Mark as processed successfully
                    await this.#supabase
                        .from('staging_jobs')
                        .update({ 
                            processed: true,
                            processing_metadata: {
                                ...stagedJob.processing_metadata,
                                processed_at: new Date().toISOString(),
                                status: 'success'
                            }
                        })
                        .eq('id', stagedJob.id);

                    processed++;
                } catch (err: any) {
                    logger.error('Error processing staged job:', {
                        error: err,
                        jobId: stagedJob.original_id
                    });

                    // Mark as processed with error
                    try {
                        await this.#supabase
                            .from('staging_jobs')
                            .update({ 
                                processed: true,
                                processing_metadata: {
                                    ...stagedJob.processing_metadata,
                                    processed_at: new Date().toISOString(),
                                    status: 'error',
                                    error: err.message || String(err)
                                }
                            })
                            .eq('id', stagedJob.id);
                    } catch (updateError) {
                        logger.error('Error updating failed job status:', {
                            error: updateError,
                            jobId: stagedJob.original_id
                        });
                    }
                }
            }

            logger.info(`Processed ${processed} jobs from staging`);
            
            // Break if we've processed less than the batch size
            if (batch.length < batchSize) break;
        }
    }

    async #clearStaged(institutionId: string) {
        const { error } = await this.#supabase
            .from('staging_jobs')
            .delete()
            .eq('institution_id', institutionId)
            .eq('processed', true);

        if (error) {
            logger.error('Error clearing staged data:', { error });
            throw error;
        }
    }

    async #getOrCreateCompany({ name, institutionId }: { name: string, institutionId: string }) {
        const { data: existingCompany, error: searchError } = await this.#supabase
            .from('companies')
            .select('id')
            .eq('name', name)
            .eq('institution_id', institutionId)
            .single();

        if (searchError && searchError.code !== 'PGRST116') {
            throw searchError;
        }

        if (existingCompany) {
            return existingCompany.id;
        }

        const { data: newCompany, error: createError } = await this.#supabase
            .from('companies')
            .insert({
                name,
                institution_id: institutionId,
                description: `NSW Government - ${name}`
            })
            .select('id')
            .single();

        if (createError) {
            throw createError;
        }

        return newCompany.id;
    }

    async #createJob(stagedJob: StagedJob, companyId: string) {
        const { error } = await this.#supabase
            .from('jobs')
            .insert({
                company_id: companyId,
                title: stagedJob.raw_data.title,
                source_id: stagedJob.source_id,
                original_id: stagedJob.original_id,
                source_url: stagedJob.raw_data.source_url,
                department: stagedJob.raw_data.department,
                locations: [stagedJob.raw_data.location],
                close_date: new Date(stagedJob.raw_data.close_date),
                remuneration: stagedJob.raw_data.remuneration,
                raw_json: stagedJob.raw_data.raw_job,
                first_seen_at: new Date(),
                last_updated_at: new Date()
            });

        if (error) {
            throw error;
        }
    }

    async #updateJob(jobId: string, stagedJob: StagedJob, companyId: string) {
        const { error } = await this.#supabase
            .from('jobs')
            .update({
                company_id: companyId,
                title: stagedJob.raw_data.title,
                source_url: stagedJob.raw_data.source_url,
                department: stagedJob.raw_data.department,
                locations: [stagedJob.raw_data.location],
                close_date: new Date(stagedJob.raw_data.close_date),
                remuneration: stagedJob.raw_data.remuneration,
                raw_json: stagedJob.raw_data.raw_job,
                last_updated_at: new Date()
            })
            .eq('id', jobId);

        if (error) {
            throw error;
        }
    }

    async #processJobDetails(jobId: string, details: JobDetails) {
        try {
            logger.info(`Processing job details for ${jobId}...`, { details });

            // First extract capabilities and skills using OpenAI
            const jobDescription = details.details?.description || '';
            const analysis = await this.#extractCapabilitiesAndSkills(jobDescription);
            logger.info(`Extracted capabilities and skills for job ${jobId}:`, { analysis });

            // Store job details - only set source_id and original_id, let external_id be generated
            const { data: jobData, error: jobError } = await this.#supabase
                .from('staging_jobs')
                .upsert({
                    institution_id: this.#institutionId,
                    source_id: 'nswgov',
                    original_id: jobId,
                    raw_data: {
                        ...details,
                        capabilities: analysis.capabilities,
                        skills: analysis.skills
                    },
                    processed: false,
                    validation_status: 'pending',
                    processing_metadata: {}
                })
                .select()
                .single();

            if (jobError) {
                logger.error('Error storing job details:', { error: jobError, jobId, details });
                throw jobError;
            }

            logger.info(`Successfully stored job details for ${jobId}`);
            return jobData;
        } catch (error) {
            logger.error('Error processing job details:', { error, jobId, details });
            throw error;
        }
    }

    async #extractCapabilitiesAndSkills(content: string) {
        try {
            const response = await this.#openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert in analyzing job descriptions and role documents to extract capabilities and skills based on the NSW Government Capability Framework. Extract capabilities with their levels (Foundational, Intermediate, Adept, Advanced, Highly Advanced) and any specific skills mentioned. Format your response as a JSON object with two arrays: 'capabilities' and 'skills'. For capabilities, include the name, level, and any behavioral indicators found. For skills, include the name and any relevant context.`
                    },
                    {
                        role: "user",
                        content: `Extract capabilities and skills from this document:\n\n${content}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000,
                response_format: { type: "json_object" }
            });

            const result = response.choices[0].message.content;
            if (!result) {
                throw new Error('No content returned from OpenAI');
            }
            
            try {
                // Parse the response into structured data
                const parsed = JSON.parse(result);
                return {
                    capabilities: parsed.capabilities || [],
                    skills: parsed.skills || []
                };
            } catch (parseError) {
                logger.error('Error parsing OpenAI response:', {
                    error: {
                        message: parseError instanceof Error ? parseError.message : String(parseError),
                        response: result
                    }
                });
                return { capabilities: [], skills: [] };
            }
        } catch (error) {
            logger.error('Error calling OpenAI:', {
                error: {
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    details: error instanceof Error ? error : undefined
                }
            });
            return { capabilities: [], skills: [] };
        }
    }

    async #upsertToStagingCapability(capabilityData: any) {
        const { data, error } = await this.#supabase
            .from('staging_capabilities')
            .upsert(capabilityData, {
                onConflict: 'institution_id,source_id,external_id'
            });

        if (error) throw error;
        return data;
    }

    async #upsertToStagingSkill(skillData: any) {
        const { data, error } = await this.#supabase
            .from('staging_skills')
            .upsert(skillData, {
                onConflict: 'institution_id,source_id,external_id'
            });

        if (error) throw error;
        return data;
    }

    async #processJob(job: JobDetails) {
        try {
            const jobId = job.jobId || '';
            if (!jobId) {
                throw new Error('Job ID is required');
            }

            // Process job details and get capabilities/skills
            const jobData = await this.#processJobDetails(jobId, job);

            // Process extracted capabilities
            if (jobData.raw_data.capabilities?.length > 0) {
                for (const capability of jobData.raw_data.capabilities) {
                    try {
                        const capabilityData = {
                            institution_id: this.#institutionId,
                            source_id: 'nswgov',
                            external_id: `cap_${capability.name.toLowerCase().replace(/\s+/g, '_')}`,
                            name: capability.name,
                            description: capability.description || '',
                            source_framework: 'NSW Government Capability Framework',
                            is_occupation_specific: false,
                            raw_data: capability
                        };
                        
                        await this.#upsertToStagingCapability(capabilityData);
                    } catch (error) {
                        logger.error(`Error processing capability for job ${jobId}:`, { error });
                    }
                }
            }

            // Process extracted skills
            if (jobData.raw_data.skills?.length > 0) {
                for (const skill of jobData.raw_data.skills) {
                    try {
                        const skillData = {
                            institution_id: this.#institutionId,
                            source_id: 'nswgov',
                            external_id: `skill_${skill.name.toLowerCase().replace(/\s+/g, '_')}`,
                            name: skill.name,
                            description: skill.description || '',
                            source: 'job_description',
                            is_occupation_specific: true,
                            raw_data: skill
                        };
                        
                        await this.#upsertToStagingSkill(skillData);
                    } catch (error) {
                        logger.error(`Error processing skill for job ${jobId}:`, { error });
                    }
                }
            }

            return jobData;
        } catch (error) {
            logger.error('Error processing job:', { error, job });
            throw error;
        }
    }
}

// Example usage:
// const processor = new ETLProcessor();
// await processor.processInstitution('nsw-gov', [{ name: 'Department 1', jobs: [] }, { name: 'Department 2', jobs: [] }]); 