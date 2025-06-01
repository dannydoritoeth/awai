import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import OpenAI from 'openai';

interface CapabilityLevel {
    name: string;
    level: string;
    behavioralIndicators: string[];
    framework_type: string;
}

interface CapabilityMapping {
    capabilities: CapabilityLevel[];
}

interface CapabilityFramework {
    id: string;
    name: string;
    levels: string[];
    groups: string[];
    description?: string;
}

export class CapabilityService {
    private supabase: SupabaseClient;
    private openai: OpenAI;

    // Default NSW framework definition
    private readonly NSW_FRAMEWORK: CapabilityFramework = {
        id: 'nsw-core',
        name: 'NSW Government Capability Framework',
        levels: [
            'Foundational',
            'Intermediate',
            'Adept',
            'Advanced',
            'Highly Advanced'
        ],
        groups: [
            'Personal Attributes',
            'Relationships',
            'Results',
            'Business Enablers'
        ],
        description: 'The NSW Public Sector Capability Framework'
    };

    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_KEY!
        );
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    async generateCapabilities(jobData: any, sourceId: string, institutionId: string): Promise<CapabilityLevel[]> {
        try {
            // Get the appropriate framework for this institution/source
            const framework = await this.getFrameworkForInstitution(institutionId);
            
            if (sourceId === 'nswgov') {
                return await this.generateNSWCapabilities(jobData);
            } else {
                return await this.mapToFramework(jobData, framework);
            }
        } catch (error) {
            logger.error('Error generating capabilities', {
                error: error instanceof Error ? error.message : String(error),
                jobData,
                institutionId
            });
            return [];
        }
    }

    private async getFrameworkForInstitution(institutionId: string): Promise<CapabilityFramework> {
        try {
            // Try to get institution-specific framework
            const { data: framework } = await this.supabase
                .from('capability_frameworks')
                .select('*')
                .eq('institution_id', institutionId)
                .single();

            if (framework) {
                return {
                    id: framework.id,
                    name: framework.name,
                    levels: framework.levels,
                    groups: framework.groups,
                    description: framework.description
                };
            }

            // If no specific framework, check if institution uses NSW framework
            const { data: institution } = await this.supabase
                .from('institutions')
                .select('uses_nsw_framework')
                .eq('id', institutionId)
                .single();

            if (institution?.uses_nsw_framework) {
                return this.NSW_FRAMEWORK;
            }

            // Get institution's default framework
            const { data: defaultFramework } = await this.supabase
                .from('capability_frameworks')
                .select('*')
                .eq('is_default', true)
                .single();

            if (defaultFramework) {
                return {
                    id: defaultFramework.id,
                    name: defaultFramework.name,
                    levels: defaultFramework.levels,
                    groups: defaultFramework.groups,
                    description: defaultFramework.description
                };
            }

            // Fallback to NSW framework if nothing else is defined
            return this.NSW_FRAMEWORK;

        } catch (error) {
            logger.error('Error getting framework for institution', {
                error: error instanceof Error ? error.message : String(error),
                institutionId
            });
            // Fallback to NSW framework
            return this.NSW_FRAMEWORK;
        }
    }

    async updateJobCapabilities(jobId: string, capabilities: CapabilityLevel[]): Promise<void> {
        try {
            // Remove existing capabilities
            await this.supabase
                .from('job_capabilities')
                .delete()
                .eq('job_id', jobId);

            // Create new capabilities
            await this.createJobCapabilities(jobId, capabilities);
        } catch (error) {
            logger.error('Error updating job capabilities', {
                error: error instanceof Error ? error.message : String(error),
                jobId
            });
        }
    }

    async createJobCapabilities(jobId: string, capabilities: CapabilityLevel[]): Promise<void> {
        try {
            const capabilityLinks = await Promise.all(
                capabilities.map(async (cap) => {
                    // Find or create capability
                    const { data: existing } = await this.supabase
                        .from('capabilities')
                        .select('id')
                        .eq('name', cap.name)
                        .eq('level', cap.level)
                        .eq('framework_type', cap.framework_type)
                        .single();

                    if (existing) {
                        return {
                            job_id: jobId,
                            capability_id: existing.id,
                            level: cap.level,
                            framework_type: cap.framework_type
                        };
                    }

                    const { data: created } = await this.supabase
                        .from('capabilities')
                        .insert({
                            name: cap.name,
                            level: cap.level,
                            behavioral_indicators: cap.behavioralIndicators,
                            framework_type: cap.framework_type
                        })
                        .select('id')
                        .single();

                    if (!created) {
                        throw new Error(`Failed to create capability: ${cap.name}`);
                    }

                    return {
                        job_id: jobId,
                        capability_id: created.id,
                        level: cap.level,
                        framework_type: cap.framework_type
                    };
                })
            );

            // Create job-capability links
            await this.supabase
                .from('job_capabilities')
                .insert(capabilityLinks);

        } catch (error) {
            logger.error('Error creating job capabilities', {
                error: error instanceof Error ? error.message : String(error),
                jobId
            });
        }
    }

    private async generateNSWCapabilities(jobData: any): Promise<CapabilityLevel[]> {
        // For NSW Gov jobs, extract capabilities from the job data
        const capabilities: CapabilityLevel[] = [];
        
        if (jobData.capabilities) {
            for (const cap of jobData.capabilities) {
                capabilities.push({
                    name: cap.name,
                    level: cap.level,
                    behavioralIndicators: cap.indicators || [],
                    framework_type: 'nsw-core'
                });
            }
        }

        return capabilities;
    }

    private async mapToFramework(jobData: any, framework: CapabilityFramework): Promise<CapabilityLevel[]> {
        const systemPrompt = `You are an expert in the ${framework.name}. Your task is to analyze job descriptions and map them to appropriate capabilities and levels from the framework. Consider the role's responsibilities, requirements, and seniority level.`;

        const userPrompt = `Please analyze this job and suggest appropriate capabilities and levels for the ${framework.name}.

Job Title: ${jobData.title}
Description: ${jobData.description}
Seniority: ${jobData.seniority || 'Not specified'}

The framework has these levels:
${framework.levels.join(', ')}

And these capability groups:
${framework.groups.join(', ')}

Return ONLY a valid JSON object with suggested capabilities and levels, with behavioral indicators for each.
Format:
{
  "capabilities": [
    {
      "name": "capability name",
      "level": "capability level",
      "behavioralIndicators": ["indicator 1", "indicator 2", ...],
      "framework_type": "${framework.id}"
    }
  ]
}`;

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

        const content = completion.choices[0].message.content;
        if (!content) {
            throw new Error('No response from OpenAI');
        }

        const response = JSON.parse(content) as CapabilityMapping;
        return response.capabilities;
    }
} 