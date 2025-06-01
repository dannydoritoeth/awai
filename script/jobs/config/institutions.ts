import { z } from 'zod';

// Institution configuration schema
export const InstitutionConfigSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    sourceId: z.string(),
    type: z.enum(['government', 'private']),
    active: z.boolean().default(true),
    settings: z.object({
        capabilityFramework: z.string(),
        roleMapping: z.string(),
        companyDetection: z.boolean().default(false),
        roleStandardization: z.boolean().default(false),
        validationRules: z.array(z.string()).default([]),
        scrapingConfig: z.object({
            baseUrl: z.string().optional(),
            apiEndpoint: z.string().optional(),
            rateLimit: z.number().default(1000), // ms between requests
            maxConcurrent: z.number().default(5)
        }).default({}),
        processingRules: z.object({
            titleNormalization: z.boolean().default(true),
            descriptionCleaning: z.boolean().default(true),
            locationNormalization: z.boolean().default(true),
            salaryExtraction: z.boolean().default(true)
        }).default({})
    }).default({})
});

export type InstitutionConfig = z.infer<typeof InstitutionConfigSchema>;

// Predefined institution configurations
export const INSTITUTIONS: Record<string, InstitutionConfig> = {
    'nsw-gov': {
        id: '550e8400-e29b-41d4-a716-446655440000', // Example UUID
        name: 'NSW Government',
        sourceId: 'nswgov',
        type: 'government',
        settings: {
            capabilityFramework: 'nsw-core-capabilities',
            roleMapping: 'nsw-role-types',
            validationRules: [
                'mandatory_fields',
                'date_validation',
                'capability_validation'
            ],
            scrapingConfig: {
                baseUrl: 'https://iworkfor.nsw.gov.au',
                rateLimit: 2000,
                maxConcurrent: 3
            },
            processingRules: {
                titleNormalization: true,
                descriptionCleaning: true,
                locationNormalization: true,
                salaryExtraction: true
            }
        }
    },
    'private-sector': {
        id: '550e8400-e29b-41d4-a716-446655440001', // Example UUID
        name: 'Private Sector',
        sourceId: 'seek',
        type: 'private',
        settings: {
            capabilityFramework: 'general-capabilities',
            roleMapping: 'general-role-types',
            companyDetection: true,
            roleStandardization: true,
            validationRules: [
                'mandatory_fields',
                'date_validation',
                'company_validation'
            ],
            scrapingConfig: {
                baseUrl: 'https://www.seek.com.au',
                rateLimit: 5000,
                maxConcurrent: 2
            }
        }
    }
};

// Helper functions
export function getInstitutionConfig(institutionId: string): InstitutionConfig | undefined {
    return INSTITUTIONS[institutionId];
}

export function isInstitutionActive(institutionId: string): boolean {
    const config = getInstitutionConfig(institutionId);
    return config?.active ?? false;
}

export function getValidationRules(institutionId: string): string[] {
    const config = getInstitutionConfig(institutionId);
    return config?.settings.validationRules ?? [];
}

export function getProcessingRules(institutionId: string): InstitutionConfig['settings']['processingRules'] {
    const config = getInstitutionConfig(institutionId);
    return config?.settings.processingRules ?? {
        titleNormalization: true,
        descriptionCleaning: true,
        locationNormalization: true,
        salaryExtraction: true
    };
} 