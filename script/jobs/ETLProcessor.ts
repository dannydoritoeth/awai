import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';
import { DocumentProcessor } from "../utils/documentProcessor.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { OpenAI } from 'openai';
import { Department as DepartmentType } from '../types/department.js';

const JobSchema = z.object({
    title: z.string(),
    department: z.string(),
    subDepartment: z.string().nullable().optional(),
    location: z.string(),
    salary: z.string(),
    closingDate: z.string(),
    jobId: z.string(),
    id: z.string().optional(),
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
    title?: string;
    department?: string;
    department_name?: string;
    location?: string;
    close_date?: string;
    remuneration?: string;
    source_url?: string;
    raw_job?: {
        job?: {
            raw_data?: {
                id: string;
                title: string;
                department: string;
                location?: string;
                salary: string;
                closingDate: string;
                sourceUrl: string;
            }
        };
        role?: {
    title: string;
    department: string;
            location?: string;
            salary: string;
            closingDate: string;
            sourceUrl: string;
        }
    };
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
    sync_status: string;
    last_synced_at: string | null;
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
    #maxJobs: number;

    constructor({ maxJobs = 10, supabase, institution_id }: {
        maxJobs?: number;
        supabase: SupabaseClient;
        institution_id: string;
    }) {
        this.#maxJobs = maxJobs;
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
        try {
            logger.info(`Processing institution ${institutionId}`);
            
            // Process each department's jobs
            for (const dept of departments) {
                logger.info(`Processing department: ${dept.name}`);
                
                // Process jobs for this department
                for (const job of dept.jobs) {
                    try {
                        // Check if job already exists in staging
                        const { data: existingJob, error: checkError } = await this.#supabase
                            .from('jobs')
                            .select('id, sync_status, last_synced_at')
                            .eq('source_id', job.source || 'nswgov')
                            .eq('original_id', job.jobId)
                            .single();

                        if (checkError && checkError.code !== 'PGRST116') {
                            logger.error('Error checking existing job:', {
                                error: {
                                    message: checkError.message,
                                    details: checkError.details,
                                    hint: checkError.hint,
                                    code: checkError.code
                                }
                            });
                            continue;
                        }

                        // Get or create company
                        const companyData = await this.#getOrCreateCompany({
                            name: dept.name || job.department || 'NSW Government',
                            institutionId
                        });

                        const jobData = {
                            company_id: companyData[0].id,
                            source_id: job.source || 'nswgov',
                            original_id: job.jobId,
                            title: job.title,
                            department: job.department,
                            job_type: 'Full-Time',
                            source_url: job.sourceUrl,
                            remuneration: job.salary,
                            close_date: job.closingDate ? new Date(job.closingDate) : null,
                            locations: [job.location],
                            sync_status: 'pending',
                            last_synced_at: new Date().toISOString(),
                            raw_data: {
                                title: job.title,
                                department: job.department,
                                location: job.location,
                                salary: job.salary,
                                closingDate: job.closingDate,
                                sourceUrl: job.sourceUrl,
                                source: job.source || 'nswgov',
                                institution: job.institution
                            }
                        };

                        if (existingJob) {
                            // Update existing job
                            const { error: updateError } = await this.#supabase
                                .from('jobs')
                                .update(jobData)
                                .eq('id', existingJob.id);

                            if (updateError) {
                                logger.error('Error updating job:', {
                                    error: {
                                        message: updateError.message,
                                        details: updateError.details,
                                        hint: updateError.hint,
                                        code: updateError.code
                                    }
                                });
                            } else {
                                logger.info(`Successfully updated job ${job.jobId}`);
                            }
                        } else {
                            // Insert new job
                            const { error: insertError } = await this.#supabase
                                .from('jobs')
                                .insert(jobData);

                            if (insertError) {
                                logger.error('Error inserting job:', {
                                    error: {
                                        message: insertError.message,
                                        details: insertError.details,
                                        hint: insertError.hint,
                                        code: insertError.code
                                    }
                                });
                            } else {
                                logger.info(`Successfully inserted job ${job.jobId}`);
                            }
                        }
                    } catch (error) {
                        logger.error('Error processing job:', {
                            error: error instanceof Error ? {
                                name: error.name,
                                message: error.message,
                                stack: error.stack
                            } : error,
                            job
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Error in ETL process:', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                } : error
            });
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
                        // Get documents from documents table
                        const { data: docs, error } = await this.#supabase
                            .from('documents')
                            .select('*')
                            .eq('institution_id', institutionId)
                            .eq('metadata->>jobId', job.jobId)
                            .eq('processing_status', 'pending');

                        if (error) {
                            throw error;
                        }

                        if (docs?.length) {
                            totalDocuments += docs.length;
                            
                            // Update processing status
                            await this.#supabase
                                .from('documents')
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
            dept.jobs.map(job => {
                // Get the original job ID from the source
                const rawId = job.jobId || job.id || (job as any).raw_data?.id;
                if (!rawId) {
                    logger.warn('No original job ID found:', { job });
                    return null;
                }
                
                const original_id = String(rawId);
                const source_id = (job.source || 'nswgov') as string;

                return {
                    institution_id: institutionId,
                    source_id,
                    original_id,
                    raw_data: {
                        title: job.title,
                        department: job.department,
                        department_name: dept.name,
                        location: job.location,
                        close_date: job.closingDate,
                        remuneration: job.salary,
                        source_url: job.sourceUrl,
                        source: source_id,
                        job_id: original_id,
                        raw_job: job
                    },
                    validation_status: 'pending',
                    processed: false,
                    processing_metadata: {},
                    sync_status: 'pending',
                    last_synced_at: null
                };
            }).filter(Boolean)
        );

        // Log the staging batch for debugging
        logger.debug('Staging batch:', { 
            count: stagingBatch.length,
            sample: stagingBatch[0]
        });

        // Upsert into staging database
        const { data, error } = await this.#supabase
            .from('jobs')
            .upsert(stagingBatch)
            .select();

        if (error) {
            logger.error('Error staging jobs:', { error });
            throw error;
        }

        stagedCount = data?.length || 0;
        return stagedCount;
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
            .from('jobs')
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
            if (departmentName) {  // Add null check to fix TypeScript error
                await this.#getOrCreateCompany({
                    name: departmentName,
                    institutionId
                });
            }
        }
    }

    async #processStagedJobs(institutionId: string) {
        // Process in batches to avoid timeout
        const batchSize = 100;
        let processed = 0;
        let skipped = 0;
        
        while (true) {
            const { data: batch, error } = await this.#supabase
                .from('jobs')
                .select('*')
                .eq('source_id', 'nswgov')
                .eq('processed', false)
                .limit(batchSize);

            if (error) throw error;
            if (!batch?.length) break;

            for (const stagedJob of batch) {
                try {
                    // Extract job data to check for duplicates
                    const rawJob = stagedJob.raw_data.raw_job?.job?.raw_data || stagedJob.raw_data.raw_job?.role || stagedJob.raw_data;
                    const title = rawJob.title;
                    const department = rawJob.department || stagedJob.raw_data.department_name;

                    if (!title) {
                        throw new Error('Job title is required');
                    }

                    // Check if job already exists using title and department
                    const { data: existingJob } = await this.#supabase
                        .from('jobs')
                        .select('id, version')
                        .eq('source_id', stagedJob.source_id)
                        .eq('title', title)
                        .eq('department', department)
                        .maybeSingle();

                    if (existingJob) {
                        // Job already exists, mark as processed and skip
                        await this.#supabase
                            .from('jobs')
                            .update({ 
                                processed: true,
                                processing_metadata: {
                                    ...stagedJob.processing_metadata,
                                    processed_at: new Date().toISOString(),
                                    status: 'skipped',
                                    reason: 'Job already exists in database',
                                    existing_job_id: existingJob.id
                                }
                            })
                            .eq('id', stagedJob.id);
                        
                        skipped++;
                        logger.info(`Skipped existing job: ${title} in ${department}`);
                        continue;
                    }

                    // Log the raw data for debugging
                    logger.info('Processing staged job:', {
                        title,
                        department,
                        source: stagedJob.source_id
                    });

                    // Ensure source_id is set
                    if (!stagedJob.source_id) {
                        stagedJob.source_id = 'nswgov';
                        // Update the record with source_id
                        await this.#supabase
                            .from('jobs')
                            .update({ source_id: 'nswgov' })
                            .eq('id', stagedJob.id);
                    }

                    const companyId = await this.#getOrCreateCompany({
                        name: department || 'NSW Government',
                        institutionId
                    });

                    await this.#createJob(stagedJob, companyId);

                    // Mark as processed successfully
                    await this.#supabase
                        .from('jobs')
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
                            .from('jobs')
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

            logger.info(`Processed batch: ${processed} jobs processed, ${skipped} jobs skipped`);
            
            // Break if we've processed less than the batch size
            if (batch.length < batchSize) break;
        }

        logger.info(`Finished processing: ${processed} jobs processed, ${skipped} jobs skipped`);
    }

    async #clearStaged(institutionId: string) {
        const { error } = await this.#supabase
            .from('jobs')
            .delete()
            .eq('source_id', 'nswgov')
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
        try {
            // Extract job data from raw_data, ensuring we have all required fields
            const rawJob = stagedJob.raw_data.raw_job?.job?.raw_data || stagedJob.raw_data.raw_job?.role || stagedJob.raw_data;
            
            // Ensure we have a title
            if (!rawJob.title) {
                throw new Error('Job title is required');
            }

            const jobData = {
                company_id: companyId,
                title: rawJob.title,
                source_id: stagedJob.source_id,
                original_id: stagedJob.original_id,
                source_url: 'sourceUrl' in rawJob ? rawJob.sourceUrl : rawJob.source_url,
                department: rawJob.department || '',
                locations: [rawJob.location].filter(Boolean),
                close_date: new Date('closingDate' in rawJob ? rawJob.closingDate : (rawJob.close_date || new Date().toISOString())),
                remuneration: 'salary' in rawJob ? rawJob.salary : (rawJob.remuneration || 'Not specified'),
                raw_json: stagedJob.raw_data,
                first_seen_at: new Date(),
                last_updated_at: new Date()
            };

            // Log the job data for debugging
            logger.debug('Creating job with data:', {
                jobId: stagedJob.original_id,
                data: jobData
            });

            const { error } = await this.#supabase
                .from('jobs')
                .insert(jobData);

            if (error) {
                throw error;
            }

            logger.info(`Successfully created job: ${stagedJob.original_id}`);
        } catch (error) {
            logger.error(`Error creating job ${stagedJob.original_id}:`, {
                error,
                stagedJob: {
                    id: stagedJob.id,
                    original_id: stagedJob.original_id,
                    raw_data: stagedJob.raw_data
                }
            });
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

            // Ensure source is set
            const source = details.source || 'nswgov';

            // Store job details with the correct conflict key
            const { data: jobData, error: jobError } = await this.#supabase
                .from('jobs')
                .upsert({
                    source_id: source,
                    original_id: details.jobId,
                    raw_data: {
                        capabilities: analysis.capabilities,
                        skills: analysis.skills,
                        ...details
                    },
                    processed: false,
                    processing_metadata: {},
                    validation_status: 'pending',
                    validation_timestamp: null,
                    validation_errors: {},
                    sync_status: 'pending',
                    last_synced_at: null
                }, {
                    onConflict: 'company_id,source_id,original_id'
                })
                .select();

            if (jobError) {
                logger.error('Error storing job:', {
                    error: {
                        message: jobError.message,
                        details: jobError.details,
                        hint: jobError.hint
                    }
                });
                throw jobError;
            }

            // If no data returned, try to fetch the record
            if (!jobData || jobData.length === 0) {
                const { data: fetchedJob, error: fetchError } = await this.#supabase
                    .from('jobs')
                    .select('*')
                    .eq('source_id', source)
                    .eq('original_id', details.jobId)
                    .maybeSingle();

                if (fetchError) {
                    logger.error('Error fetching job:', {
                        error: {
                            message: fetchError.message,
                            details: fetchError.details,
                            hint: fetchError.hint
                        }
                    });
                    throw fetchError;
                }

                return fetchedJob;
            }

            return jobData[0];
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
            .from('capabilities')
            .upsert(capabilityData, {
                onConflict: 'normalized_key,company_id'
            });

        if (error) throw error;
        return data;
    }

    async #upsertToStagingSkill(skillData: any) {
        const { data, error } = await this.#supabase
            .from('skills')
            .upsert(skillData, {
                onConflict: 'id'
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

    async #initializeCapabilityLevels() {
        try {
            logger.info('Initializing capability levels...');
            
            const levels = [
                { level: 'Foundational', summary: 'Basic level of capability', behavioral_indicators: [] },
                { level: 'Intermediate', summary: 'Moderate level of capability', behavioral_indicators: [] },
                { level: 'Adept', summary: 'Skilled level of capability', behavioral_indicators: [] },
                { level: 'Advanced', summary: 'High level of capability', behavioral_indicators: [] },
                { level: 'Highly Advanced', summary: 'Expert level of capability', behavioral_indicators: [] }
            ];

            // First, get all existing levels for this institution
            const { data: existingLevels, error: fetchError } = await this.#supabase
                .from('capability_levels')
                .select('id, level')
                .eq('institution_id', this.#institutionId);

            if (fetchError) {
                throw fetchError;
            }

            // Create a map of existing levels
            const existingLevelMap = new Map(
                existingLevels?.map(level => [level.level, level.id]) || []
            );

            // Process each level
            for (const level of levels) {
                const existingId = existingLevelMap.get(level.level);

                if (existingId) {
                    // Update existing level
                    const { error: updateError } = await this.#supabase
                        .from('capability_levels')
                        .update({
                            summary: level.summary,
                            behavioral_indicators: level.behavioral_indicators,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingId);

                    if (updateError) {
                        throw updateError;
                    }

                    logger.info(`Updated capability level: ${level.level}`);
                } else {
                    // Insert new level
                    const { error: insertError } = await this.#supabase
                        .from('capability_levels')
                        .insert({
                            institution_id: this.#institutionId,
                            source_id: null, // This will be set when linking to specific capabilities
                            capability_id: null, // This will be set when linking to specific capabilities
                            level: level.level,
                            summary: level.summary,
                            behavioral_indicators: level.behavioral_indicators,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });

                    if (insertError) {
                        throw insertError;
                    }

                    logger.info(`Created capability level: ${level.level}`);
                }
            }

            logger.info('Successfully initialized capability levels');
        } catch (error) {
            logger.error('Error initializing capability levels:', { error });
            throw error;
        }
    }
}

// Example usage:
// const processor = new ETLProcessor();
// await processor.processInstitution('nsw-gov', [{ name: 'Department 1', jobs: [] }, { name: 'Department 2', jobs: [] }]); 