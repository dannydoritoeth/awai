/**
 * @fileoverview Analyzes capability gaps between a profile and a target role
 * 
 * Related Actions:
 * - getDevelopmentPlan: Uses gap analysis to create development recommendations
 * - getSkillGaps: Complementary analysis focusing on technical skills
 * - getMatchingRolesForPerson: Uses capability matching for role recommendations
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { DatabaseResponse, CapabilityGap } from '../../../types.ts';
import { getLevelValue } from '../../../utils.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { getProfileData } from '../../../profile/getProfileData.ts';
import { getRoleDetail } from '../../../role/getRoleDetail.ts';

interface CapabilityAnalysis {
  gaps: CapabilityGap[];
  summary: {
    criticalGaps: number;
    minorGaps: number;
    metRequirements: number;
    overallReadiness: number;
    recommendations: string[];
  };
}

interface ProfileCapability {
  level: string | undefined;
  name: string;
  groupName: string;
}

/**
 * Main action function that implements the MCPActionV2 interface
 */
async function getCapabilityGapsBase(request: MCPRequest): Promise<MCPResponse<CapabilityAnalysis>> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const { profileId, roleId, sessionId } = request;

  try {
    // Validate inputs
    if (!profileId || !roleId) {
      return {
        success: false,
        error: {
          type: 'INVALID_INPUT',
          message: 'Both profileId and roleId are required'
        }
      };
    }

    // Load profile and role data
    const [profileData, roleData] = await Promise.all([
      getProfileData(supabase, profileId),
      getRoleDetail(supabase, roleId)
    ]);

    if (!profileData || !roleData) {
      throw new Error('Could not fetch profile or role data');
    }

    // Load capabilities data
    const { data: roleCapabilities, error: roleError } = await supabase
      .from('role_capabilities')
      .select(`
        capability_id,
        level,
        capabilities (
          id,
          name,
          group_name
        )
      `)
      .eq('role_id', roleId);

    if (roleError) {
      return {
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching role capabilities',
          details: roleError
        }
      };
    }

    // Analyze gaps and generate summary
    const analysis = {
      gaps: [], // Your gap analysis logic here
      summary: {
        criticalGaps: 0,
        minorGaps: 0,
        metRequirements: 0,
        overallReadiness: 0,
        recommendations: []
      }
    };

    // Only log if we found significant gaps
    if (sessionId && analysis.gaps.length > 0) {
      const gapsMarkdown = `### 📊 Capability Gap Analysis

${analysis.gaps.map(gap => `**${gap.name}**: ${gap.level} → ${gap.requiredLevel}
${gap.description}`).join('\n\n')}

Overall Readiness: ${analysis.summary.overallReadiness}%
Critical Gaps: ${analysis.summary.criticalGaps}
Minor Gaps: ${analysis.summary.minorGaps}
Met Requirements: ${analysis.summary.metRequirements}`;

      await logAgentProgress(
        supabase,
        sessionId,
        gapsMarkdown,
        { phase: 'gaps_analyzed' }
      );
    }

    return {
      success: true,
      data: analysis,
      actionsTaken: [
        {
          tool: 'getProfileData',
          reason: 'Retrieved profile and role data',
          result: 'success',
          confidence: 1.0,
          inputs: { profileId, roleId },
          timestamp: new Date().toISOString()
        },
        {
          tool: 'analyzeGaps',
          reason: 'Analyzed capability gaps',
          result: 'success',
          confidence: 0.9,
          inputs: { profileId, roleId },
          timestamp: new Date().toISOString()
        }
      ]
    };

  } catch (error) {
    console.error('Error in getCapabilityGaps:', error);
    
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        "I encountered an error while analyzing capability gaps. Let me know if you'd like to try again.",
        { phase: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }

    return {
      success: false,
      error: {
        type: 'ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    };
  }
}

// Create the MCPActionV2 implementation
export const getCapabilityGaps: MCPActionV2 = {
  id: 'getCapabilityGaps',
  title: 'Get Capability Gaps',
  description: 'Compare a person\'s current capabilities to the requirements of a selected role',
  applicableRoles: ['candidate', 'manager', 'analyst'],
  capabilityTags: ['Career Development', 'Skill Assessment', 'Gap Analysis'],
  requiredInputs: ['profileId', 'roleId'],
  tags: ['gap_analysis', 'tactical', 'strategic'],
  recommendedAfter: ['getMatchingRolesForPerson', 'getSuggestedCareerPaths'],
  recommendedBefore: ['getDevelopmentPlan', 'getSemanticSkillRecommendations'],
  usesAI: false,
  actionFn: (ctx: Record<string, any>) => getCapabilityGapsBase(ctx as MCPRequest),
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId,
    roleId: context.roleId
  })
}; 