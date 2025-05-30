import { ETLDatabase, StagingDocument, StagingJob } from './database/etl';
import { JobValidator, ValidationError } from './validation';
import { getInstitutionConfig, isInstitutionActive } from './config/institutions';
import { CompanyDetectionService } from './services/CompanyDetection';
import { TaxonomyService } from './services/TaxonomyService';
import { CapabilityService } from './services/CapabilityService';
import { logger } from '../utils/logger';

export class ETLProcessor {
    private db: ETLDatabase;
    private validator: JobValidator;
    private companyDetector: CompanyDetectionService;
    private taxonomyService: TaxonomyService;
    private capabilityService: CapabilityService;

    constructor() {
        this.db = new ETLDatabase();
        this.validator = new JobValidator();
        this.companyDetector = new CompanyDetectionService();
        this.taxonomyService = new TaxonomyService();
        this.capabilityService = new CapabilityService();
    }

    async processInstitution(institutionId: string): Promise<void> {
        if (!isInstitutionActive(institutionId)) {
            logger.info(`Institution ${institutionId} is not active, skipping processing`);
            return;
        }

        try {
            // 1. Process pending documents
            await this.processDocuments(institutionId);

            // 2. Validate staged jobs
            await this.validateJobs(institutionId);

            // 3. Promote validated jobs
            await this.promoteJobs(institutionId);

            // 4. Cleanup old records
            await this.cleanup();
        } catch (error) {
            logger.error('Error processing institution', {
                institutionId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private async processDocuments(institutionId: string): Promise<void> {
        const documents = await this.db.getPendingDocuments(institutionId);
        logger.info(`Processing ${documents.length} documents for institution ${institutionId}`);

        for (const doc of documents) {
            try {
                // Extract job data from document
                const jobData = await this.extractJobData(doc);

                // Create staging job
                const stagingJob: StagingJob = {
                    document_id: doc.id!,
                    institution_id: institutionId,
                    source_id: doc.source_id,
                    original_id: jobData.id,
                    raw_data: jobData,
                    processed: false,
                    validation_status: 'pending',
                    validation_timestamp: undefined,
                    validation_errors: undefined,
                    processing_metadata: {
                        taxonomies: [],
                        capabilities: []
                    }
                };

                // If private sector, handle company detection
                if (doc.source_id !== 'nswgov') {
                    const companyInfo = await this.detectCompanyInfo(jobData);
                    stagingJob.company_id = companyInfo.companyId;
                    stagingJob.division_id = companyInfo.divisionId;
                }

                // Process taxonomies
                const taxonomies = await this.taxonomyService.generateTaxonomies(jobData);
                stagingJob.processing_metadata.taxonomies = taxonomies;

                // Process capabilities
                const capabilities = await this.capabilityService.generateCapabilities(jobData, doc.source_id);
                stagingJob.processing_metadata.capabilities = capabilities;

                const newJobId = await this.db.insertStagingJob(stagingJob);
                await this.db.updateDocumentStatus(doc.id!, 'processed');

                logger.info('Successfully processed document', {
                    documentId: doc.id,
                    jobId: newJobId,
                    taxonomies: taxonomies.length,
                    capabilities: capabilities.length
                });

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                await this.db.updateDocumentStatus(doc.id!, 'failed', errorMessage);
                await this.db.recordProcessingFailure(
                    doc.id!,
                    'processing_error',
                    errorMessage
                );
                logger.error('Failed to process document', {
                    documentId: doc.id,
                    error: errorMessage
                });
            }
        }
    }

    private async validateJobs(institutionId: string): Promise<void> {
        const jobs = await this.db.getValidatedJobs(institutionId);
        logger.info(`Validating ${jobs.length} jobs for institution ${institutionId}`);

        for (const job of jobs) {
            try {
                const validationErrors = await this.validator.validateJob(job);

                if (validationErrors.length === 0) {
                    await this.db.updateJobValidation(job.id!, 'valid');
                } else {
                    await this.db.updateJobValidation(job.id!, 'invalid', validationErrors);
                    
                    // Record individual validation failures
                    for (const error of validationErrors) {
                        await this.db.recordValidationFailure(
                            job.id!,
                            error.type,
                            error.field || null,
                            error.message,
                            error.data
                        );
                    }
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error('Validation error', {
                    jobId: job.id,
                    error: errorMessage
                });
            }
        }
    }

    private async promoteJobs(institutionId: string): Promise<void> {
        const jobs = await this.db.getValidatedJobs(institutionId);
        logger.info(`Promoting ${jobs.length} validated jobs for institution ${institutionId}`);

        for (const job of jobs) {
            try {
                // Check if job already exists
                const existingJob = await this.db.findExistingJob(
                    job.institution_id,
                    job.source_id,
                    job.original_id
                );

                if (existingJob) {
                    // Compare and update if needed
                    const transformedData = await this.transformJobData(job.raw_data);
                    await this.db.updateExistingJob(existingJob.id, transformedData);
                    
                    // Update taxonomies and capabilities if they exist in metadata
                    if (job.processing_metadata?.taxonomies) {
                        await this.updateJobTaxonomies(existingJob.id, job.processing_metadata.taxonomies);
                    }
                    if (job.processing_metadata?.capabilities) {
                        await this.updateJobCapabilities(existingJob.id, job.processing_metadata.capabilities);
                    }
                    
                    logger.info(`Updated existing job`, {
                        jobId: existingJob.id,
                        externalId: `${job.source_id}:${job.original_id}`
                    });
                } else {
                    // Create new job
                    const newJobId = await this.db.promoteJob(job.id!);
                    
                    // Create taxonomies and capabilities if they exist in metadata
                    if (job.processing_metadata?.taxonomies) {
                        await this.createJobTaxonomies(newJobId, job.processing_metadata.taxonomies);
                    }
                    if (job.processing_metadata?.capabilities) {
                        await this.createJobCapabilities(newJobId, job.processing_metadata.capabilities);
                    }
                    
                    logger.info(`Created new job from staging`, {
                        stagingId: job.id,
                        jobId: newJobId,
                        externalId: `${job.source_id}:${job.original_id}`
                    });
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                logger.error('Failed to promote job', {
                    stagingId: job.id,
                    error: errorMessage
                });
            }
        }
    }

    private async updateJobTaxonomies(jobId: string, taxonomies: string[]): Promise<void> {
        await this.taxonomyService.updateJobTaxonomies(jobId, taxonomies);
    }

    private async createJobTaxonomies(jobId: string, taxonomies: string[]): Promise<void> {
        await this.taxonomyService.createJobTaxonomies(jobId, taxonomies);
    }

    private async updateJobCapabilities(jobId: string, capabilities: any[]): Promise<void> {
        await this.capabilityService.updateJobCapabilities(jobId, capabilities);
    }

    private async createJobCapabilities(jobId: string, capabilities: any[]): Promise<void> {
        await this.capabilityService.createJobCapabilities(jobId, capabilities);
    }

    private async transformJobData(rawData: any): Promise<any> {
        // Transform raw data into the format expected by the production jobs table
        // This is where you would apply any final transformations or normalizations
        return {
            title: this.normalizeTitle(rawData.title),
            description: this.cleanDescription(rawData.description),
            open_date: rawData.open_date,
            close_date: rawData.close_date,
            department: rawData.department,
            department_id: rawData.department_id,
            job_type: this.normalizeJobType(rawData.job_type),
            source_url: rawData.source_url,
            remuneration: this.normalizeRemuneration(rawData.remuneration),
            recruiter: rawData.recruiter,
            locations: this.normalizeLocations(rawData.locations)
        };
    }

    private normalizeTitle(title: string): string {
        // Remove excessive whitespace and standardize case
        return title
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s-]/g, '')
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    private cleanDescription(description: string): string {
        // Remove HTML tags, normalize whitespace, etc.
        return description
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ') // Replace HTML entities
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();
    }

    private normalizeJobType(jobType: string): string {
        // Map various job type strings to standard values
        const typeMap: Record<string, string> = {
            'ft': 'Full Time',
            'fulltime': 'Full Time',
            'full-time': 'Full Time',
            'pt': 'Part Time',
            'parttime': 'Part Time',
            'part-time': 'Part Time',
            'casual': 'Casual',
            'contract': 'Contract',
            'temp': 'Temporary',
            'temporary': 'Temporary'
        };

        const normalized = jobType.toLowerCase().replace(/[^a-z]/g, '');
        return typeMap[normalized] || jobType;
    }

    private normalizeRemuneration(remuneration: any): any {
        if (typeof remuneration === 'string') {
            // Extract salary range if present
            const matches = remuneration.match(/\$?([\d,]+)(?:\s*-\s*\$?([\d,]+))?/);
            if (matches) {
                const min = parseInt(matches[1].replace(/,/g, ''));
                const max = matches[2] ? parseInt(matches[2].replace(/,/g, '')) : min;
                return {
                    min,
                    max,
                    original: remuneration
                };
            }
        }
        return remuneration;
    }

    private normalizeLocations(locations: string | string[]): string[] {
        if (typeof locations === 'string') {
            // Split comma-separated locations
            return locations.split(/,\s*/).map(loc => this.normalizeLocation(loc));
        }
        return locations.map(loc => this.normalizeLocation(loc));
    }

    private normalizeLocation(location: string): string {
        // Standardize location names
        return location
            .trim()
            .replace(/\s+/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    private async cleanup(): Promise<void> {
        try {
            // Cleanup processed documents older than 7 days
            await this.db.cleanupProcessedDocuments(7);
            
            // Cleanup failed documents older than 30 days
            await this.db.cleanupFailedDocuments(30);
        } catch (error) {
            logger.error('Cleanup error', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    private async extractJobData(doc: StagingDocument): Promise<any> {
        // This would contain your logic to transform raw document data into structured job data
        // The implementation will depend on your specific data format and requirements
        const rawContent = doc.raw_content;
        
        // Basic transformation example - you would need to adapt this to your needs
        return {
            id: rawContent.id || rawContent.jobId,
            title: rawContent.title,
            description: rawContent.description,
            open_date: rawContent.openDate || rawContent.startDate,
            close_date: rawContent.closeDate || rawContent.endDate,
            department: rawContent.department,
            locations: Array.isArray(rawContent.locations) ? rawContent.locations : [rawContent.location],
            // Add other fields based on your schema
        };
    }

    private async detectCompanyInfo(jobData: any): Promise<{ companyId?: string, divisionId?: string }> {
        try {
            const match = await this.companyDetector.detectCompany(jobData);
            if (match) {
                logger.info('Company detected', {
                    companyId: match.companyId,
                    divisionId: match.divisionId,
                    confidence: match.confidence
                });
                return {
                    companyId: match.companyId,
                    divisionId: match.divisionId
                };
            }
        } catch (error) {
            logger.error('Error detecting company', {
                error: error instanceof Error ? error.message : String(error),
                jobData: {
                    company: jobData.company_name,
                    department: jobData.department
                }
            });
        }
        return {};
    }
}

// Example usage:
// const processor = new ETLProcessor();
// await processor.processInstitution('nsw-gov'); 