import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../../database.types.ts';
import { DatabaseResponse, CapabilityGap } from '../../../types.ts';
import { getLevelValue } from '../../../utils.ts';
import { MCPActionV2, MCPRequest, MCPResponse } from '../../types/action.ts';
import { buildSafePrompt } from '../../promptBuilder.ts';
import { invokeChatModel } from '../../../ai/invokeAIModel.ts';
import { logAgentAction } from '../../../agent/logAgentAction.ts';
import { logAgentResponse } from '../../../chatUtils.ts';

interface CapabilityAnalysis {
  gaps: CapabilityGap[];
  summary: {
    criticalGaps: number;
    minorGaps: number;
    metRequirements: number;
    overallReadiness: number;
    recommendations: string[];
  };
  aiInsights: {
    message: string;
    followUpQuestion?: string;
  };
}

interface ProfileCapability {
  level: string | undefined;
  name: string;
  groupName: string;
}

async function analyzeCapabilityGaps(
  gaps: CapabilityGap[],
  profileName: string,
  roleName: string
): Promise<{ message: string; followUpQuestion?: string }> {
  const promptData = {
    systemPrompt: `You are an expert career advisor analyzing capability gaps between a person and a role. 
    Provide actionable insights and recommendations based on the gap analysis.
    Focus on both strengths and areas for development.
    Be encouraging but realistic about development needs.`,
    userMessage: `Please analyze the capability gaps between ${profileName} and the ${roleName} role.`,
    data: {
      gaps: gaps.map(gap => ({
        capability: gap.name,
        group: gap.groupName,
        type: gap.gapType,
        severity: gap.severity,
        currentLevel: gap.profileLevel,
        requiredLevel: gap.requiredLevel
      }))
    }
  };

  const prompt = buildSafePrompt('openai:gpt-3.5-turbo', promptData, {
    maxItems: 10,
    maxFieldLength: 200
  });

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

  const parts = aiResponse.output.split(/\n\nFollow-up question:/i);
  return {
    message: parts[0].trim(),
    followUpQuestion: parts[1]?.trim()
  };
}

// Define the base function that implements the MCPActionV2 actionFn signature
async function getCapabilityGapsBase(request: MCPRequest): Promise<MCPResponse<CapabilityAnalysis>> {
  const supabase = request.supabase as SupabaseClient<Database>;
  const { profileId, roleId, sessionId } = request;

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

    // Log starting analysis
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "I'm analyzing the capability gaps between your profile and the target role...",
        'capability_analysis_start'
      );
    }

    // Get role and profile details for context
    const [roleDetails, profileDetails] = await Promise.all([
      supabase.from('roles').select('name, title').eq('id', roleId).single(),
      supabase.from('profiles').select('name').eq('id', profileId).single()
    ]);

    // Get role capabilities with a single query joining necessary tables
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

    // Log role data loaded
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "I've loaded the role requirements, now checking your capabilities...",
        'role_data_loaded'
      );
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

    // Create a map of profile capabilities for easy lookup
    const profileCapMap = new Map<string, ProfileCapability>(
      profileCapabilities?.map(pc => [pc.capability_id, {
        level: pc.level,
        name: pc.capabilities.name,
        groupName: pc.capabilities.group_name
      }]) || []
    );

    // Analyze gaps
    const gaps: CapabilityGap[] = roleCapabilities?.map(rc => {
      const profileCap: ProfileCapability = profileCapMap.get(rc.capability_id) || { 
        level: undefined,
        name: '',
        groupName: ''
      };
      const requiredLevel = rc.level;
      const profileLevel = profileCap.level;

      // Calculate gap type and severity
      let gapType: 'missing' | 'insufficient' | 'met' = 'missing';
      let severity = 100; // Default to max severity for missing capabilities

      if (profileLevel) {
        const requiredValue = getLevelValue(requiredLevel);
        const profileValue = getLevelValue(profileLevel);

        if (profileValue >= requiredValue) {
          gapType = 'met';
          severity = 0;
        } else {
          gapType = 'insufficient';
          // Calculate severity as a percentage of the gap
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

    // Sort gaps by severity (highest first) and then by group name
    gaps.sort((a, b) => {
      const severityA = a.severity ?? 0;
      const severityB = b.severity ?? 0;
      if (severityA !== severityB) {
        return severityB - severityA;
      }
      return (a.groupName || '').localeCompare(b.groupName || '');
    });

    // Calculate summary statistics
    const summary = {
      criticalGaps: gaps.filter(g => (g.severity ?? 0) > 70).length,
      minorGaps: gaps.filter(g => (g.severity ?? 0) > 0 && (g.severity ?? 0) <= 70).length,
      metRequirements: gaps.filter(g => (g.severity ?? 0) === 0).length,
      overallReadiness: 100 - (gaps.reduce((acc, g) => acc + (g.severity ?? 0), 0) / gaps.length),
      recommendations: []
    };

    // Get AI analysis
    const aiInsights = await analyzeCapabilityGaps(
      gaps,
      profileDetails?.data?.name || 'the profile',
      roleDetails?.data?.title || 'the role'
    );

    // Log analysis completion
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        aiInsights.message,
        'capability_analysis_complete',
        undefined,
        {
          gaps: gaps.slice(0, 5),
          summary,
          followUpQuestion: aiInsights.followUpQuestion
        }
      );
    }

    // Log the analysis details
    await logAgentAction(supabase, {
      entityType: 'profile',
      entityId: profileId,
      payload: {
        action: 'capability_gap_analysis',
        roleId,
        summary,
        gapCount: gaps.length,
        criticalGapsCount: summary.criticalGaps
      },
      semanticMetrics: {
        similarityScores: {
          roleMatch: 0.8,
          skillAlignment: 0.7,
          capabilityAlignment: 0.75
        },
        matchingStrategy: 'hybrid',
        confidenceScore: 0.9
      }
    });

    return {
      success: true,
      data: {
        gaps,
        summary,
        aiInsights
      },
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
    // Log error to chat if we have a session
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "I encountered an error while analyzing capability gaps. Let me know if you'd like to try again.",
        'capability_analysis_error'
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
  actionFn: (ctx: Record<string, any>) => getCapabilityGapsBase(ctx as MCPRequest)
}; 