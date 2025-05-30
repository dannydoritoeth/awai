import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

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
    source: z.string()
});

type Department = {
    name: string;
    jobs: z.infer<typeof JobSchema>[];
};

export class ETLProcessor {
    #supabase;

    constructor() {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
            throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_KEY');
        }

        this.#supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY
        );
    }

    async processInstitution(institutionId: string, departments: Department[]) {
        logger.info(`Processing institution ${institutionId}`);

        try {
            for (const department of departments) {
                const companyId = await this.#getOrCreateCompany({
                    name: department.name,
                    institutionId: institutionId
                });

                // Process jobs for this department
                await this.#processJobs(companyId, department.jobs);
            }

        } catch (error) {
            logger.error('Error processing institution:', { error });
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

        if (searchError && searchError.code !== 'PGRST116') { // PGRST116 is "not found"
            throw searchError;
        }

        if (existingCompany) {
            return existingCompany.id;
        }

        // Create new company
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

    async #processJobs(companyId: string, jobs: z.infer<typeof JobSchema>[]) {
        let successCount = 0;
        let errorCount = 0;
        let updateCount = 0;

        logger.info(`Processing ${jobs.length} jobs for company ${companyId}`);

        for (const job of jobs) {
            try {
                // Validate job data
                const validatedJob = JobSchema.parse(job);

                // Check if job exists
                const { data: existingJob } = await this.#supabase
                    .from('jobs')
                    .select('id, version')
                    .eq('company_id', companyId)
                    .eq('source_id', validatedJob.source)
                    .eq('original_id', validatedJob.jobId)
                    .single();

                if (existingJob) {
                    // Update existing job
                    await this.#updateJob(existingJob.id, validatedJob, companyId);
                    updateCount++;
                    logger.info(`Updated existing job: ${validatedJob.jobId}`);
                } else {
                    // Create new job
                    await this.#createJob(validatedJob, companyId);
                    successCount++;
                    logger.info(`Created new job: ${validatedJob.jobId}`);
                }

            } catch (err: any) {
                errorCount++;
                if (err?.name === 'ZodError') {
                    logger.error('Job validation error:', {
                        jobId: job.jobId,
                        errors: err.errors
                    });
                } else {
                    logger.error('Error processing job:', {
                        error: err?.message || err,
                        jobId: job.jobId,
                        company: companyId
                    });
                }
                // Continue with next job
            }
        }

        logger.info('Job processing summary:', {
            total: jobs.length,
            created: successCount,
            updated: updateCount,
            errors: errorCount
        });
    }

    async #createJob(job: z.infer<typeof JobSchema>, companyId: string) {
        const { error } = await this.#supabase
            .from('jobs')
            .insert({
                company_id: companyId,
                title: job.title,
                source_id: job.source,
                original_id: job.jobId,
                source_url: job.sourceUrl,
                department: job.department,
                locations: [job.location],
                close_date: new Date(job.closingDate),
                remuneration: job.salary,
                raw_json: job
            });

        if (error) {
            throw error;
        }
    }

    async #updateJob(jobId: string, job: z.infer<typeof JobSchema>, companyId: string) {
        const { error } = await this.#supabase
            .from('jobs')
            .update({
                title: job.title,
                source_url: job.sourceUrl,
                department: job.department,
                locations: [job.location],
                close_date: new Date(job.closingDate),
                remuneration: job.salary,
                raw_json: job,
                last_updated_at: new Date()
            })
            .eq('id', jobId);

        if (error) {
            throw error;
        }
    }
}

// Example usage:
// const processor = new ETLProcessor();
// await processor.processInstitution('nsw-gov', [{ name: 'Department 1', jobs: [] }, { name: 'Department 2', jobs: [] }]); 