import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import type { Database } from '../../../database.types.ts';
import { invokeChatModelV2 } from '../../ai/invokeAIModelV2.ts';

export interface CapabilityData {
  company: string;
  taxonomy?: string;
  division?: string;
  region?: string;
  capability: string;
  role_count: number;
  total_roles: number;
  percentage: number;
}

export async function buildCapabilityAnalysisPrompt(data: CapabilityData[], message: string) {
  // Create a structured summary of the data
  const summary = {
    totalRoles: data[0]?.total_roles || 0,
    taxonomyCount: new Set(data.map(d => d.taxonomy)).size,
    capabilityCount: new Set(data.map(d => d.capability)).size,
    companies: Array.from(new Set(data.map(d => d.company))),
  };

  const systemPrompt = `You are an AI analyst providing insights on organizational capabilities.
Your task is to analyze capability distribution data and provide clear, actionable insights.

The data shows how capabilities are distributed across different taxonomies/divisions/regions in the organization.
Each entry includes:
- Capability name
- Number of roles with that capability
- Total roles in that group
- Percentage of roles with that capability

Focus on:
1. Key patterns and trends
2. Notable strengths and potential gaps
3. Actionable recommendations
4. Areas that may need attention

RESPONSE FORMAT:
Please structure your response in markdown format.

Keep your analysis clear and concise, highlighting the most important findings.`;

  const userPrompt = `Please analyze this capability distribution data and ${message}

Data Summary:
- Total Roles Analyzed: ${summary.totalRoles}
- Number of Taxonomies: ${summary.taxonomyCount}
- Total Capabilities: ${summary.capabilityCount}
- Companies: ${summary.companies.join(', ')}

The full data is provided in JSON format below:
${JSON.stringify(data, null, 2)}`;

  return { systemPrompt, userPrompt };
}

export async function analyzeCapabilityData(
  data: CapabilityData[],
  message: string
): Promise<{ response: string; followUpQuestion?: string }> {
  const { systemPrompt, userPrompt } = await buildCapabilityAnalysisPrompt(data, message);

  const aiResponse = await invokeChatModelV2(
    {
      system: systemPrompt,
      user: userPrompt
    },
    {
      model: 'openai:gpt-3.5-turbo',
      temperature: 0.2,
      max_tokens: 1000
    }
  );

  if (!aiResponse.success || !aiResponse.output) {
    throw new Error(`AI analysis failed: ${aiResponse.error?.message || 'Unknown error'}`);
  }

  // Split response into main analysis and follow-up question if present
  const parts = aiResponse.output.split(/\n\nFollow-up question:/i);
  
  return {
    response: parts[0].trim(),
    followUpQuestion: parts[1]?.trim()
  };
} 