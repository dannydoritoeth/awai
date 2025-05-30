import { z } from 'zod';
import { StagingJob } from '../database/etl';
import { getValidationRules } from '../config/institutions';

// Validation error structure
export interface ValidationError {
    type: string;
    field?: string;
    message: string;
    data?: any;
}

// Base job validation schema
const BaseJobSchema = z.object({
    title: z.string().min(3),
    description: z.string().min(10),
    open_date: z.string().datetime(),
    close_date: z.string().datetime().optional(),
    department: z.string(),
    locations: z.array(z.string()).min(1)
});

// Government-specific validation schema
const GovernmentJobSchema = BaseJobSchema.extend({
    department_id: z.string(),
    capability_framework: z.array(z.string()).min(1),
    grade_level: z.string()
});

// Private sector validation schema
const PrivateSectorJobSchema = BaseJobSchema.extend({
    company_name: z.string(),
    industry: z.string(),
    employment_type: z.string()
});

export class JobValidator {
    private validateMandatoryFields(job: StagingJob): ValidationError[] {
        const errors: ValidationError[] = [];
        const data = job.raw_data;

        try {
            if (job.source_id === 'nswgov') {
                GovernmentJobSchema.parse(data);
            } else {
                PrivateSectorJobSchema.parse(data);
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                errors.push(...error.errors.map(err => ({
                    type: 'mandatory_field',
                    field: err.path.join('.'),
                    message: err.message
                })));
            }
        }

        return errors;
    }

    private validateDates(job: StagingJob): ValidationError[] {
        const errors: ValidationError[] = [];
        const { open_date, close_date } = job.raw_data;

        if (open_date && close_date) {
            const openDate = new Date(open_date);
            const closeDate = new Date(close_date);

            if (closeDate < openDate) {
                errors.push({
                    type: 'date_validation',
                    field: 'close_date',
                    message: 'Close date cannot be before open date'
                });
            }

            // Job cannot be open for more than 6 months
            const sixMonthsFromOpen = new Date(openDate);
            sixMonthsFromOpen.setMonth(sixMonthsFromOpen.getMonth() + 6);

            if (closeDate > sixMonthsFromOpen) {
                errors.push({
                    type: 'date_validation',
                    field: 'close_date',
                    message: 'Job cannot be open for more than 6 months'
                });
            }
        }

        return errors;
    }

    private validateCapabilities(job: StagingJob): ValidationError[] {
        const errors: ValidationError[] = [];

        if (job.source_id === 'nswgov') {
            const { capability_framework } = job.raw_data;

            if (!Array.isArray(capability_framework) || capability_framework.length === 0) {
                errors.push({
                    type: 'capability_validation',
                    field: 'capability_framework',
                    message: 'At least one capability must be specified'
                });
            } else {
                // Here you would typically validate against a predefined list of capabilities
                // This is a placeholder for the actual validation
                const validCapabilities = new Set(['leadership', 'communication', 'technical']);
                
                for (const capability of capability_framework) {
                    if (!validCapabilities.has(capability)) {
                        errors.push({
                            type: 'capability_validation',
                            field: 'capability_framework',
                            message: `Invalid capability: ${capability}`,
                            data: { capability }
                        });
                    }
                }
            }
        }

        return errors;
    }

    private validateCompany(job: StagingJob): ValidationError[] {
        const errors: ValidationError[] = [];

        if (job.source_id !== 'nswgov') {
            const { company_name, industry } = job.raw_data;

            if (!company_name) {
                errors.push({
                    type: 'company_validation',
                    field: 'company_name',
                    message: 'Company name is required for private sector jobs'
                });
            }

            if (!industry) {
                errors.push({
                    type: 'company_validation',
                    field: 'industry',
                    message: 'Industry is required for private sector jobs'
                });
            }
        }

        return errors;
    }

    private getValidationFunctions(rules: string[]): ((job: StagingJob) => ValidationError[])[] {
        const validationMap: Record<string, (job: StagingJob) => ValidationError[]> = {
            'mandatory_fields': this.validateMandatoryFields.bind(this),
            'date_validation': this.validateDates.bind(this),
            'capability_validation': this.validateCapabilities.bind(this),
            'company_validation': this.validateCompany.bind(this)
        };

        return rules.map(rule => validationMap[rule]).filter(Boolean);
    }

    async validateJob(job: StagingJob): Promise<ValidationError[]> {
        const rules = getValidationRules(job.institution_id);
        const validationFunctions = this.getValidationFunctions(rules);
        
        const allErrors: ValidationError[] = [];
        
        for (const validate of validationFunctions) {
            const errors = await Promise.resolve(validate(job));
            allErrors.push(...errors);
        }

        return allErrors;
    }
} 