import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { MCPActionV2, MCPResponse } from '../../types/action.ts';
import { getLevelValue } from '../../../utils.ts';
import { logAgentProgress } from '../../../chatUtils.ts';

interface SkillGap {
  skillId: string;
  name: string;
  category: string;
  requiredLevel: string;
  profileLevel?: string;
  gapType: 'missing' | 'insufficient' | 'met';
  severity: number;
}

async function getSkillGapsAction(
  supabase: SupabaseClient,
  profileId: string,
  roleId: string,
  sessionId?: string
): Promise<MCPResponse> {
  try {
    if (!profileId || !roleId) {
      return {
        success: false,
        error: {
          type: 'INVALID_INPUT',
          message: 'Both profileId and roleId are required'
        }
      };
    }

    // Get role skills with a single query joining necessary tables
    const { data: roleSkills, error: roleError } = await supabase
      .from('role_skills')
      .select(`
        skill_id,
        skills (
          id,
          name,
          category
        )
      `)
      .eq('role_id', roleId);

    if (roleError) {
      throw new Error(`Error fetching role skills: ${roleError.message}`);
    }

    // Get profile skills
    const { data: profileSkills, error: profileError } = await supabase
      .from('profile_skills')
      .select(`
        skill_id,
        rating,
        skills (
          id,
          name,
          category
        )
      `)
      .eq('profile_id', profileId);

    if (profileError) {
      throw new Error(`Error fetching profile skills: ${profileError.message}`);
    }

    // Create a map of profile skills for easy lookup
    const profileSkillMap = new Map(
      profileSkills?.map(ps => [ps.skill_id, {
        level: ps.rating,
        name: ps.skills.name,
        category: ps.skills.category
      }]) || []
    );

    // Analyze gaps
    const gaps: SkillGap[] = roleSkills?.map(rs => {
      const profileSkill = profileSkillMap.get(rs.skill_id);
      const requiredLevel = 'Intermediate'; // Default to intermediate since schema doesn't store level
      const profileLevel = profileSkill?.level;

      // Calculate gap type and severity
      let gapType: 'missing' | 'insufficient' | 'met' = 'missing';
      let severity = 100; // Default to max severity for missing skills

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
        skillId: rs.skill_id,
        name: rs.skills.name,
        category: rs.skills.category,
        requiredLevel,
        profileLevel,
        gapType,
        severity
      };
    }) || [];

    // Sort gaps by severity (highest first) and then by category
    gaps.sort((a, b) => {
      if (a.severity !== b.severity) {
        return b.severity - a.severity;
      }
      return (a.category || '').localeCompare(b.category || '');
    });

    // Generate markdown summary
    const gapSummary = gaps.length > 0 
      ? `### Skill Gaps Analysis\n\n${gaps.map(gap => 
          `**${gap.name}** (${gap.category})\n` +
          `- Current Level: ${gap.profileLevel || 'None'}\n` +
          `- Required Level: ${gap.requiredLevel}\n` +
          `- Status: ${gap.gapType} (${gap.severity.toFixed(1)}% gap)\n`
        ).join('\n')}`
      : "No significant skill gaps identified.";

    if (sessionId) {
      await logAgentProgress(
        supabase,
        sessionId,
        gapSummary,
        { phase: 'gaps_analyzed' }
      );
    }

    return {
      success: true,
      data: gaps,
      dataForDownstreamPrompt: {
        getSkillGaps: {
          dataSummary: gapSummary,
          structured: {
            gaps: gaps.map(gap => ({
              name: gap.name,
              currentLevel: getLevelValue(gap.profileLevel || 'None'),
              requiredLevel: getLevelValue(gap.requiredLevel),
              gap: gap.severity
            }))
          },
          truncated: false
        }
      }
    };

  } catch (error) {
    console.error('Error in getSkillGaps:', error);
    return {
      success: false,
      error: {
        type: 'SKILL_GAPS_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error
      }
    };
  }
}

export const getSkillGaps: MCPActionV2 = {
  id: 'getSkillGaps',
  title: 'Get Skill Gaps',
  description: 'Analyze gaps between profile skills and role requirements',
  applicableRoles: ['candidate', 'manager', 'analyst'],
  capabilityTags: ['Skills Analysis', 'Gap Analysis'],
  requiredInputs: ['profileId', 'roleId'],
  tags: ['skills', 'gaps', 'analysis'],
  suggestedPrerequisites: [],
  suggestedPostrequisites: ['getSemanticSkillRecommendations', 'explainMatch'],
  usesAI: false,
  actionFn: async (context: Record<string, any>) => {
    return getSkillGapsAction(
      context.supabase,
      context.profileId,
      context.roleId,
      context.sessionId
    );
  },
  getDefaultArgs: (context: Record<string, any>) => ({
    profileId: context.profileId,
    roleId: context.roleId
  })
}; 