import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Database schemas
export const StagingDocumentSchema = z.object({
    id: z.number().optional(),
    institution_id: z.string().uuid(),
    source_id: z.string(),
    external_id: z.string(),
    raw_content: z.record(z.any()),
    scraped_at: z.date().optional(),
    processed_at: z.date().optional(),
    processing_status: z.string().default('pending'),
    error_details: z.string().optional(),
    metadata: z.record(z.any()).optional()
});

export const StagingJobSchema = z.object({
    id: z.number().optional(),
    document_id: z.number(),
    institution_id: z.string().uuid(),
    company_id: z.string().uuid().optional(),
    division_id: z.string().uuid().optional(),
    source_id: z.string(),
    original_id: z.string(),
    raw_data: z.record(z.any()),
    processed: z.boolean().default(false),
    processing_metadata: z.record(z.any()).optional(),
    validation_status: z.string().default('pending'),
    validation_timestamp: z.date().optional(),
    validation_errors: z.array(z.any()).optional()
});

export type StagingDocument = z.infer<typeof StagingDocumentSchema>;
export type StagingJob = z.infer<typeof StagingJobSchema>;

export class ETLDatabase {
    private supabase: SupabaseClient;

    constructor() {
        // Initialize Supabase client
        this.supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_KEY!
        );
    }

    // Document Management
    async insertDocument(doc: StagingDocument): Promise<number> {
        const { data, error } = await this.supabase
            .from('staging_documents')
            .insert({
                institution_id: doc.institution_id,
                source_id: doc.source_id,
                external_id: doc.external_id,
                raw_content: doc.raw_content,
                metadata: doc.metadata
            })
            .select('id')
            .single();

        if (error) throw error;
        return data.id;
    }

    async updateDocumentStatus(id: number, status: string, error?: string): Promise<void> {
        const { error: updateError } = await this.supabase
            .from('staging_documents')
            .update({
                processing_status: status,
                error_details: error,
                processed_at: status === 'processed' ? new Date().toISOString() : null
            })
            .eq('id', id);

        if (updateError) throw updateError;
    }

    async getPendingDocuments(institutionId: string, limit: number = 100): Promise<StagingDocument[]> {
        const { data, error } = await this.supabase
            .from('staging_documents')
            .select('*')
            .eq('institution_id', institutionId)
            .eq('processing_status', 'pending')
            .limit(limit);

        if (error) throw error;
        return data;
    }

    // Job Management
    async insertStagingJob(job: StagingJob): Promise<number> {
        const { data, error } = await this.supabase
            .from('staging_jobs')
            .insert({
                document_id: job.document_id,
                institution_id: job.institution_id,
                company_id: job.company_id,
                division_id: job.division_id,
                source_id: job.source_id,
                original_id: job.original_id,
                raw_data: job.raw_data,
                processing_metadata: job.processing_metadata
            })
            .select('id')
            .single();

        if (error) throw error;
        return data.id;
    }

    async updateJobValidation(
        id: number,
        status: string,
        errors?: any[]
    ): Promise<void> {
        const { error } = await this.supabase
            .from('staging_jobs')
            .update({
                validation_status: status,
                validation_timestamp: new Date().toISOString(),
                validation_errors: errors
            })
            .eq('id', id);

        if (error) throw error;
    }

    async getValidatedJobs(institutionId: string, limit: number = 100): Promise<StagingJob[]> {
        const { data, error } = await this.supabase
            .from('staging_jobs')
            .select('*')
            .eq('institution_id', institutionId)
            .eq('validation_status', 'valid')
            .eq('processed', false)
            .limit(limit);

        if (error) throw error;
        return data;
    }

    // Error Tracking
    async recordProcessingFailure(
        documentId: number,
        errorType: string,
        errorDetails: string
    ): Promise<void> {
        const { error } = await this.supabase
            .from('staging_failed_documents')
            .insert({
                document_id: documentId,
                error_type: errorType,
                error_details: errorDetails
            });

        if (error) throw error;
    }

    async recordValidationFailure(
        jobId: number,
        validationType: string,
        fieldName: string | null,
        errorMessage: string,
        rawData: any
    ): Promise<void> {
        const { error } = await this.supabase
            .from('staging_validation_failures')
            .insert({
                staging_job_id: jobId,
                validation_type: validationType,
                field_name: fieldName,
                error_message: errorMessage,
                raw_data: rawData
            });

        if (error) throw error;
    }

    // Cleanup
    async cleanupProcessedDocuments(olderThanDays: number = 7): Promise<void> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const { error } = await this.supabase
            .from('staging_documents')
            .delete()
            .eq('processing_status', 'processed')
            .lt('processed_at', cutoffDate.toISOString());

        if (error) throw error;
    }

    async cleanupFailedDocuments(olderThanDays: number = 30): Promise<void> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const { error } = await this.supabase
            .from('staging_failed_documents')
            .delete()
            .lt('failure_timestamp', cutoffDate.toISOString());

        if (error) throw error;
    }

    // Job Promotion Methods
    async promoteJob(jobId: number): Promise<void> {
        // Start a Supabase transaction
        const { data: job, error: fetchError } = await this.supabase
            .from('staging_jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (fetchError) throw fetchError;
        if (!job) throw new Error(`Job ${jobId} not found`);

        // Insert into production jobs table
        const { error: insertError } = await this.supabase
            .from('jobs')
            .insert({
                institution_id: job.institution_id,
                company_id: job.company_id,
                division_id: job.division_id,
                source_id: job.source_id,
                original_id: job.original_id,
                title: job.raw_data.title,
                description: job.raw_data.description,
                open_date: job.raw_data.open_date,
                close_date: job.raw_data.close_date,
                department: job.raw_data.department,
                department_id: job.raw_data.department_id,
                job_type: job.raw_data.job_type,
                source_url: job.raw_data.source_url,
                remuneration: job.raw_data.remuneration,
                recruiter: job.raw_data.recruiter,
                locations: job.raw_data.locations,
                version: 1,
                first_seen_at: new Date().toISOString(),
                last_updated_at: new Date().toISOString()
            })
            .select('id')
            .single();

        if (insertError) throw insertError;

        // Create initial history record
        const { error: historyError } = await this.supabase
            .from('jobs_history')
            .insert({
                ...job.raw_data,
                institution_id: job.institution_id,
                company_id: job.company_id,
                division_id: job.division_id,
                source_id: job.source_id,
                original_id: job.original_id,
                version: 1,
                changed_fields: Object.keys(job.raw_data),
                change_type: 'create',
                change_reason: 'Initial job creation',
                created_by: 'etl_pipeline',
                raw_json: job.raw_data
            });

        if (historyError) throw historyError;

        // Mark staging job as processed
        const { error: updateError } = await this.supabase
            .from('staging_jobs')
            .update({ processed: true })
            .eq('id', jobId);

        if (updateError) throw updateError;
    }

    async updateExistingJob(jobId: number, newData: any): Promise<void> {
        // Get current job version
        const { data: currentJob, error: fetchError } = await this.supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (fetchError) throw fetchError;
        if (!currentJob) throw new Error(`Job ${jobId} not found`);

        // Detect changes
        const changedFields = Object.keys(newData).filter(
            key => JSON.stringify(currentJob[key]) !== JSON.stringify(newData[key])
        );

        if (changedFields.length === 0) {
            return; // No changes needed
        }

        // Update job with new version
        const { error: updateError } = await this.supabase
            .from('jobs')
            .update({
                ...newData,
                version: currentJob.version + 1,
                last_updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

        if (updateError) throw updateError;

        // Create history record
        const { error: historyError } = await this.supabase
            .from('jobs_history')
            .insert({
                ...currentJob,
                ...newData,
                version: currentJob.version + 1,
                changed_fields: changedFields,
                change_type: 'update',
                change_reason: 'Job details updated',
                created_by: 'etl_pipeline',
                raw_json: { ...currentJob, ...newData }
            });

        if (historyError) throw historyError;
    }

    async archiveJob(jobId: number, reason: string): Promise<void> {
        const { data: job, error: fetchError } = await this.supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (fetchError) throw fetchError;
        if (!job) throw new Error(`Job ${jobId} not found`);

        // Update job status
        const { error: updateError } = await this.supabase
            .from('jobs')
            .update({
                is_archived: true,
                version: job.version + 1,
                last_updated_at: new Date().toISOString()
            })
            .eq('id', jobId);

        if (updateError) throw updateError;

        // Create history record
        const { error: historyError } = await this.supabase
            .from('jobs_history')
            .insert({
                ...job,
                version: job.version + 1,
                changed_fields: ['is_archived'],
                change_type: 'archive',
                change_reason: reason,
                created_by: 'etl_pipeline',
                raw_json: { ...job, is_archived: true }
            });

        if (historyError) throw historyError;
    }

    async findExistingJob(institutionId: string, sourceId: string, originalId: string): Promise<any> {
        const { data, error } = await this.supabase
            .from('jobs')
            .select('*')
            .eq('institution_id', institutionId)
            .eq('source_id', sourceId)
            .eq('original_id', originalId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            throw error;
        }

        return data;
    }
} 