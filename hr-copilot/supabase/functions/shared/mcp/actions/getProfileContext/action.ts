/**
 * @fileoverview Gets detailed context about a profile including skills, capabilities, and career path
 * 
 * Purpose: Retrieves comprehensive information about a profile to provide context for
 * other actions and AI interactions.
 * 
 * Inputs:
 * - profileId: ID of the profile to get context for
 * 
 * Outputs:
 * - Profile details including skills and capabilities
 * - Career path information
 * - Recent job interactions
 * 
 * Related Actions:
 * - getCapabilityGaps: Uses profile context for analysis
 * - getSkillRecommendations: Uses profile context for recommendations
 * - getDevelopmentPlan: Uses profile context for planning
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { MCPRequest, MCPResponse, MCPActionV2 } from '../../types/action.ts';
import { getProfileContext } from '../../../profile/getProfileContext.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { ActionButtons } from '../../../utils/markdown/renderMarkdownActionButton.ts';
import { z } from "https://deno.land/x/zod/mod.ts";

const profileContextSchema = z.object({
  profileId: z.string()
});

async function getProfileContextBase(request: MCPRequest): Promise<MCPResponse> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const { profileId, sessionId } = request;

  try {
    // Input validation
    if (!profileId) {
      throw new Error('profileId is required');
    }

    // Log starting analysis
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        "I'm gathering detailed information about the profile...",
        { phase: 'analysis_start' }
      );
    }

    // Get profile context using existing implementation
    const profileContextResponse = await getProfileContext(supabase, profileId);
    if (!profileContextResponse.data) {
      throw new Error('Could not load profile context');
    }
    const profileContext = profileContextResponse.data;

    // Format the message for both chat and response
    const message = `### 👤 Profile Context for ${profileContext.profile.name}

#### Current Status
${profileContext.careerPath?.current_role ? `💼 Current Role: ${profileContext.careerPath.current_role}` : ''}
${profileContext.careerPath?.target_role ? `🎯 Target Role: ${profileContext.careerPath.target_role}` : ''}

#### Skills & Capabilities
${profileContext.profile.skills.length > 0 ? `
**Skills:**
${profileContext.profile.skills.map(skill => `- ${skill.name} (Level ${skill.level})`).join('\\n')}` : ''}

${profileContext.profile.capabilities.length > 0 ? `
**Capabilities:**
${profileContext.profile.capabilities.map(cap => `- ${cap.name} (Level ${cap.level})`).join('\\n')}` : ''}

${profileContext.jobInteractions.length > 0 ? `
#### Recent Job Interactions
${profileContext.jobInteractions.map(ji => `- ${ji.status}: ${ji.job_id} (${new Date(ji.applied_date).toLocaleDateString()})`).join('\\n')}` : ''}

${ActionButtons.profileExplorationGroup(profileId, '', profileContext.profile.name, {
  profileId: profileId,
  name: profileContext.profile.name,
  semanticScore: 1,
  currentRole: profileContext.careerPath?.current_role
})}`;

    // Log final message to chat
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        message,
        { phase: 'context_loaded' }
      );
    }

    return {
      success: true,
      message: 'Successfully retrieved profile context',
      chatResponse: {
        message,
        followUpQuestion: 'Would you like to explore any specific aspect of this profile?',
        aiPrompt: 'The user may want to explore skills, capabilities, or career path.',
        promptDetails: {
          hasSkills: profileContext.profile.skills.length > 0,
          hasCapabilities: profileContext.profile.capabilities.length > 0,
          hasCareerPath: !!profileContext.careerPath
        }
      },
      dataForDownstreamPrompt: {
        getProfileContext: {
          dataSummary: message,
          structured: {
            profileId,
            profile: {
              id: profileContext.profile.id,
              name: profileContext.profile.name,
              email: profileContext.profile.email,
              embedding: profileContext.profile.embedding,
              skills: profileContext.profile.skills.map(skill => ({
                id: skill.id,
                name: skill.name,
                level: skill.level
              })),
              capabilities: profileContext.profile.capabilities.map(cap => ({
                id: cap.id,
                name: cap.name,
                groupName: cap.group_name,
                level: cap.level
              }))
            },
            careerPath: profileContext.careerPath ? {
              currentRole: profileContext.careerPath.current_role,
              targetRole: profileContext.careerPath.target_role,
              status: profileContext.careerPath.status,
              progress: profileContext.careerPath.progress
            } : null,
            jobInteractions: profileContext.jobInteractions.map(ji => ({
              jobId: ji.job_id,
              status: ji.status,
              appliedDate: ji.applied_date
            }))
          },
          truncated: false
        }
      },
      data: profileContext
    };

  } catch (error) {
    console.error('Error in getProfileContext:', error);
    
    const errorMessage = "I encountered an error while retrieving the profile context. Let me know if you'd like to try again.";
    
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        errorMessage,
        { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      chatResponse: {
        message: errorMessage,
        followUpQuestion: 'Would you like me to try retrieving the context again?',
        aiPrompt: 'The user may want to retry or try a different approach.',
        promptDetails: {
          hadError: true,
          errorType: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      error: {
        type: 'CONTEXT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    };
  }
}

// Create the MCPActionV2 implementation
export const getProfileContextAction: MCPActionV2 = {
  id: 'getProfileContext',
  title: 'Get Profile Context',
  description: 'Get detailed context about a profile including skills, capabilities, and career path',
  applicableRoles: ['hiring_manager', 'recruiter', 'career_coach'],
  capabilityTags: ['Profile Analysis', 'Career Planning', 'Skill Assessment'],
  requiredInputs: ['profileId'],
  tags: ['profile', 'context', 'tactical'],
  suggestedPrerequisites: [],
  suggestedPostrequisites: ['getCapabilityGaps', 'getSkillRecommendations', 'getDevelopmentPlan'],
  usesAI: false,
  argsSchema: profileContextSchema,
  actionFn: (ctx: Record<string, any>) => getProfileContextBase(ctx as MCPRequest),
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId
  })
};

export default getProfileContextAction; 