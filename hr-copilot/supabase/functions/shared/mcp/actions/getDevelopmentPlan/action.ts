import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { getCapabilityGaps } from '../getCapabilityGaps/action.ts';
import { getSkillGaps } from '../../../profile/getSkillGaps.ts';
import { getProfileData } from '../../../profile/getProfileData.ts';
import { getRoleDetail } from '../../../role/getRoleDetail.ts';
import { buildSafePrompt } from '../../promptBuilder.ts';
import { invokeChatModel } from '../../../ai/invokeAIModel.ts';
import { getSemanticMatches } from '../../../embeddings.ts';
import type { Tables } from '../../../embeddings.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';

export interface DevelopmentPlan {
  recommendedSkills: Array<{
    name: string;
    priority: 'high' | 'medium' | 'low';
    currentLevel?: number;
    targetLevel: number;
    timeEstimate: string;
    trainingModules: Array<{
      name: string;
      type: string;
      duration: string;
      provider?: string;
    }>;
  }>;
  interimRoles: Array<{
    title: string;
    relevance: string;
    keySkillsGained: string[];
    typicalDuration: string;
  }>;
  suggestedMentors: Array<{
    id: string;
    name: string;
    title: string;
    expertise: string[];
    matchScore: number;
  }>;
  timeline: {
    shortTerm: string[];
    mediumTerm: string[];
    longTerm: string[];
  };
  estimatedTimeToReadiness: string;
}

// Create the base function
async function getDevelopmentPlanBase(ctx: Record<string, any>): Promise<MCPResponse<DevelopmentPlan>> {
  const request = ctx as MCPRequest;
  const supabase = request.supabase as SupabaseClient<Database>;
  const { profileId, roleId } = request;

  try {
    // 1. Get profile and role data
    const [profileData, roleData] = await Promise.all([
      getProfileData(supabase, profileId!),
      getRoleDetail(supabase, roleId!)
    ]);

    if (!profileData || !roleData) {
      throw new Error('Could not fetch profile or role data');
    }

    // 2. Get capability and skill gaps
    const [capabilityGaps, skillGaps] = await Promise.all([
      getCapabilityGaps.actionFn({
        supabase,
        profileId,
        roleId,
        mode: 'candidate',
        context: {}
      }),
      getSkillGaps(supabase, profileId!, roleId!)
    ]);

    if (!capabilityGaps.success || !capabilityGaps.data) {
      throw new Error('Could not analyze capability gaps');
    }

    // 3. Find potential mentors using semantic search
    const mentorMatches = await getSemanticMatches(
      supabase,
      { id: roleId!, table: 'roles' as Tables },
      'profiles',
      5,
      0.7
    );

    // 4. Prepare data for AI analysis
    const promptData = {
      systemPrompt: `You are an expert career development advisor. Your task is to create a detailed development plan to help an employee progress toward a target role. Focus on actionable steps and realistic timelines.

The plan should include:
1. Prioritized skill development recommendations
2. Relevant training modules and resources
3. Suggested interim roles for gaining experience
4. Potential mentors from the available matches
5. A timeline with short, medium, and long-term goals

Format your response as a JSON object matching the DevelopmentPlan interface.`,
      userMessage: 'Please create a development plan based on the provided data.',
      data: {
        profile: {
          skills: profileData.skills.map(s => ({
            name: s.name,
            currentLevel: s.level,
            years: s.years
          })),
          capabilities: profileData.capabilities.map(c => ({
            name: c.name,
            currentLevel: c.level
          }))
        },
        targetRole: roleData,
        gaps: {
          capabilities: capabilityGaps.data || [],
          skills: skillGaps.data || []
        },
        potentialMentors: mentorMatches.map(match => ({
          id: match.id,
          name: match.name || '',
          title: match.metadata?.title,
          expertise: match.metadata?.expertise,
          similarity: match.similarity
        }))
      }
    };

    const prompt = buildSafePrompt('openai:gpt-3.5-turbo', promptData, {
      maxItems: 10,
      maxFieldLength: 200
    });

    // 5. Generate development plan using AI
    const aiResponse = await invokeChatModel(
      {
        system: prompt.system,
        user: prompt.user
      },
      {
        model: 'openai:gpt-3.5-turbo',
        temperature: 0.2
      }
    );

    if (!aiResponse.success || !aiResponse.output) {
      throw new Error(`AI API error: ${aiResponse.error?.message || 'Unknown error'}`);
    }

    // 6. Parse and validate the AI response
    const developmentPlan = JSON.parse(aiResponse.output);

    // 7. Return the development plan with proper MCPResponse structure
    return {
      success: true,
      data: developmentPlan,
      actionsTaken: [
        {
          tool: 'getProfileData',
          reason: 'Retrieved profile data',
          result: 'success',
          confidence: 1.0,
          inputs: { profileId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'getCapabilityGaps',
          reason: 'Analyzed capability gaps',
          result: 'success',
          confidence: 0.9,
          inputs: { profileId, roleId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'generateDevelopmentPlan',
          reason: 'Generated AI-powered development plan',
          result: 'success',
          confidence: 0.8,
          inputs: { profileId, roleId },
          timestamp: new Date().toISOString()
        }
      ],
      nextActions: [
        {
          type: 'review_plan',
          description: 'Review and customize development plan',
          priority: 'high'
        },
        {
          type: 'connect_mentor',
          description: 'Connect with suggested mentors',
          priority: 'medium'
        },
        {
          type: 'start_training',
          description: 'Begin recommended training modules',
          priority: 'high'
        }
      ]
    };

  } catch (error) {
    console.error('Error in getDevelopmentPlan:', error);
    return {
      success: false,
      error: {
        type: 'DEVELOPMENT_PLAN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    };
  }
}

// Create the MCPActionV2 implementation
export const getDevelopmentPlan: MCPActionV2 = {
  id: 'getDevelopmentPlan',
  title: 'Get Development Plan',
  description: 'Generate a detailed development plan for a profile to reach a target role',
  applicableRoles: ['candidate', 'manager'],
  capabilityTags: ['Career Development', 'Skill Development', 'Mentoring'],
  requiredInputs: ['profileId', 'roleId'],
  actionFn: getDevelopmentPlanBase
}; 