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
import { DatabaseResponse } from '../../../types.ts';
import { getLevelValue } from '../../../utils.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { logAgentProgress } from '../../../chatUtils.ts';
import { getProfileData } from '../../../profile/getProfileData.ts';
import { getRoleDetail } from '../../../role/getRoleDetail.ts';

interface CapabilityGap {
  capabilityId: string;
  name: string;
  groupName: string;
  level?: string;
  requiredLevel: string;
  gapType: 'missing' | 'insufficient' | 'met';
  severity: number;
  description: string;
}

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

    // Get profile capabilities
    const { data: profileCapabilities, error: profileError } = await supabase
      .from('profile_capabilities')
      .select(`
        capability_id,
        level,
        capabilities (
          id,
          name,
          group_name
        )
      `)
      .eq('profile_id', profileId);

    if (profileError) {
      return {
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Error fetching profile capabilities',
          details: profileError
        }
      };
    }

    // Create map of profile capabilities for quick lookup
    const profileCapMap = new Map<string, ProfileCapability>(
      profileCapabilities?.map(pc => [pc.capability_id, {
        level: pc.level,
        name: pc.capabilities.name,
        groupName: pc.capabilities.group_name
      }]) || []
    );

    // Analyze gaps
    const gaps: CapabilityGap[] = roleCapabilities?.map(rc => {
      const profileCap = profileCapMap.get(rc.capability_id) || {
        level: undefined,
        name: rc.capabilities.name,
        groupName: rc.capabilities.group_name
      };

      // Default to 'Intermediate' if no required level is specified
      const requiredLevel = rc.level || 'Intermediate';
      const currentLevel = profileCap.level;

      let gapType: 'missing' | 'insufficient' | 'met' = 'missing';
      let severity = 100;
      let description = '';

      if (currentLevel) {
        const requiredValue = getLevelValue(requiredLevel);
        const profileValue = getLevelValue(currentLevel);

        if (profileValue >= requiredValue) {
          gapType = 'met';
          severity = 0;
          description = `You meet or exceed the required level (${requiredLevel}) for this capability.`;
        } else {
          gapType = 'insufficient';
          severity = ((requiredValue - profileValue) / requiredValue) * 100;
          description = `Your current level (${currentLevel}) is below the required level (${requiredLevel}). Focus on developing this capability further.`;
        }
      } else {
        description = `This capability is required at level ${requiredLevel} but not found in your profile. Consider developing this capability.`;
      }

      return {
        capabilityId: rc.capability_id,
        name: rc.capabilities.name,
        groupName: rc.capabilities.group_name,
        level: currentLevel,
        requiredLevel,
        gapType,
        severity,
        description
      };
    }) || [];

    // Sort gaps by severity (we know severity is defined for all gaps)
    gaps.sort((a, b) => {
      if (a.severity !== b.severity) {
        return b.severity - a.severity;
      }
      return (a.groupName || '').localeCompare(b.groupName || '');
    });

    // Generate summary
    const analysis = {
      gaps,
      summary: {
        criticalGaps: gaps.filter(g => g.severity > 70).length,
        minorGaps: gaps.filter(g => g.severity > 0 && g.severity <= 70).length,
        metRequirements: gaps.filter(g => g.severity === 0).length,
        overallReadiness: 100 - (gaps.reduce((acc, g) => acc + g.severity, 0) / gaps.length),
      recommendations: []
      }
    };

    // Generate markdown summary for both chat and downstream prompts
    const gapsMarkdown = `### 📊 Capability Gap Analysis

${analysis.gaps.map(gap => `**${gap.name}**: ${gap.level || 'Not Present'} → ${gap.requiredLevel}
${gap.description}`).join('\n\n')}

Overall Readiness: ${analysis.summary.overallReadiness.toFixed(1)}%
Critical Gaps: ${analysis.summary.criticalGaps}
Minor Gaps: ${analysis.summary.minorGaps}
Met Requirements: ${analysis.summary.metRequirements}`;

    // Always provide feedback to the user
    if (sessionId) {
      const message = analysis.gaps.length > 0 
        ? gapsMarkdown
        : `Based on my analysis, I don't see any significant capability gaps for this role. The profile's current capabilities align well with the role requirements.

The profile meets ${analysis.summary.metRequirements} of the role requirements, showing strong alignment with the position.

Would you like me to analyze any specific aspects in more detail?`;

      await logAgentProgress(
        supabase,
        sessionId,
        message,
        { phase: analysis.gaps.length > 0 ? 'gaps_analyzed' : 'no_gaps_found' }
      );
    }

    return {
      success: true,
      data: analysis,
      dataForDownstreamPrompt: {
        getCapabilityGaps: {
          dataSummary: gapsMarkdown,
          structured: {
            overallReadiness: analysis.summary.overallReadiness,
            criticalGaps: analysis.summary.criticalGaps,
            minorGaps: analysis.summary.minorGaps,
            metRequirements: analysis.summary.metRequirements
          },
          truncated: false
        }
      },
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
  suggestedPrerequisites: ['getMatchingRolesForPerson', 'getSuggestedCareerPaths'],
  suggestedPostrequisites: ['getDevelopmentPlan', 'getSemanticSkillRecommendations'],
  usesAI: false,
  actionFn: (ctx: Record<string, any>) => getCapabilityGapsBase(ctx as MCPRequest),
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId,
    roleId: context.roleId
  })
}; 