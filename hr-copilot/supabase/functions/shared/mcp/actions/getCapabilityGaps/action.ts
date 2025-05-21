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

    // Phase 1: Load profile and role data
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        "Loading profile and role data to analyze capability gaps...",
        { phase: 'data_loading' }
      );
    }

    const [profileData, roleData] = await Promise.all([
      getProfileData(supabase, profileId),
      getRoleDetail(supabase, roleId)
    ]);

    if (!profileData || !roleData) {
      throw new Error('Could not fetch profile or role data');
    }

    // Phase 2: Load capabilities data
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        "Loading capability requirements for the role...",
        { phase: 'loading_capabilities' }
      );
    }

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

    // Phase 3: Get profile capabilities
    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        "Comparing your capabilities to the role requirements...",
        { phase: 'comparing_capabilities' }
      );
    }

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

    // Phase 4: Analyze gaps
    const profileCapMap = new Map<string, ProfileCapability>(
      profileCapabilities?.map(pc => [pc.capability_id, {
        level: pc.level,
        name: pc.capabilities.name,
        groupName: pc.capabilities.group_name
      }]) || []
    );

    const gaps: CapabilityGap[] = roleCapabilities?.map(rc => {
      const profileCap: ProfileCapability = profileCapMap.get(rc.capability_id) || { 
        level: undefined,
        name: '',
        groupName: ''
      };
      const requiredLevel = rc.level;
      const profileLevel = profileCap.level;

      let gapType: 'missing' | 'insufficient' | 'met' = 'missing';
      let severity = 100;

      if (profileLevel) {
        const requiredValue = getLevelValue(requiredLevel);
        const profileValue = getLevelValue(profileLevel);

        if (profileValue >= requiredValue) {
          gapType = 'met';
          severity = 0;
        } else {
          gapType = 'insufficient';
          severity = ((requiredValue - profileValue) / requiredValue) * 100;
        }
      }

      return {
        capabilityId: rc.capability_id,
        name: rc.capabilities.name,
        groupName: rc.capabilities.group_name,
        requiredLevel,
        profileLevel,
        gapType,
        severity
      };
    }) || [];

    // Sort gaps by severity
    gaps.sort((a, b) => {
      const severityA = a.severity ?? 0;
      const severityB = b.severity ?? 0;
      if (severityA !== severityB) {
        return severityB - severityA;
      }
      return (a.groupName || '').localeCompare(b.groupName || '');
    });

    // Generate summary
    const summary = {
      criticalGaps: gaps.filter(g => (g.severity ?? 0) > 70).length,
      minorGaps: gaps.filter(g => (g.severity ?? 0) > 0 && (g.severity ?? 0) <= 70).length,
      metRequirements: gaps.filter(g => (g.severity ?? 0) === 0).length,
      overallReadiness: 100 - (gaps.reduce((acc, g) => acc + (g.severity ?? 0), 0) / gaps.length),
      recommendations: []
    };

    return {
      success: true,
      data: {
        gaps,
        summary
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
          tool: 'analyzeCapabilityGaps',
          reason: 'Analyzed capability gaps',
          result: 'success',
          confidence: 0.9,
          inputs: { profileId, roleId },
          timestamp: new Date().toISOString()
        }
      ],
      nextActions: [
        {
          type: 'review_gaps',
          description: 'Review identified capability gaps',
          priority: 'high'
        },
        {
          type: 'development_plan',
          description: 'Create development plan to address gaps',
          priority: 'medium'
        }
      ]
    };

  } catch (error) {
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
        type: 'DATABASE_ERROR',
        message: 'Internal server error',
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