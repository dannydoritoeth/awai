import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { MCPRequest, MCPResponse, SemanticMatch, PlannerRecommendation } from '../mcpTypes.ts';
import { getSemanticMatches } from '../embeddings.ts';
import { getCapabilityGaps } from '../profile/getCapabilityGaps.ts';
import { getSkillGaps } from '../profile/getSkillGaps.ts';
import { batchScoreProfileFit } from '../agent/scoreProfileFit.ts';
import { getRolesData } from '../role/getRoleData.ts';
import { getProfileData } from '../profile/getProfileData.ts';
import { logAgentAction } from '../agent/logAgentAction.ts';
import { getHiringMatches, HiringMatch } from '../job/hiringMatches.ts';

// Type definitions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface ProfileFitScore {
  score: number;
  summary: string;
  capabilities: {
    matched: string[];
    missing: string[];
    insufficient: string[];
  };
  skills: {
    matched: string[];
    missing: string[];
    insufficient: string[];
  };
}

/**
 * Process profiles in batch for hiring matches
 */
async function processHiringMatches(
  supabase: SupabaseClient<Database>,
  roleId: string,
  options = { limit: 20, threshold: 0.7 }
): Promise<{ matches: HiringMatch[], debug: any }> {
  const debug: any = {
    timings: {},
    counts: {},
    errors: []
  };
  const startTime = Date.now();

  try {
    console.log('Starting hiring matches processing...');
    
    // 1. Get role data first
    console.log('Loading role data...');
    const roleDataStartTime = Date.now();
    const roleData = await getRolesData(supabase, [roleId]);
    if (!roleData || !roleData[roleId]) {
      throw new Error('Failed to load role data');
    }
    debug.timings.getRoleData = Date.now() - roleDataStartTime;
    
    // 2. Get semantic matches
    console.log('Getting semantic matches...');
    const semanticStartTime = Date.now();
    const profileMatches = await getSemanticMatches(
      supabase,
      { id: roleId, table: 'roles' },
      'profiles',
      options.limit,
      options.threshold
    );
    debug.timings.semanticMatching = Date.now() - semanticStartTime;
    debug.counts.semanticMatches = profileMatches.length;

    if (profileMatches.length === 0) {
      return { matches: [], debug };
    }

    // 3. Bulk load profile data
    console.log('Loading profile data...');
    const profileIds = profileMatches.map(match => match.id);
    const dataStartTime = Date.now();
    const profilesData: Record<string, any> = {};
    for (const id of profileIds) {
      const data = await getProfileData(supabase, id);
      if (data) {
        profilesData[id] = data;
      }
    }
    debug.timings.loadData = Date.now() - dataStartTime;
    debug.counts.profilesLoaded = Object.keys(profilesData).length;

    // 4. Process matches
    console.log('Processing matches...');
    const matches: HiringMatch[] = [];
    const processStartTime = Date.now();

    // Score all profiles in batch
    const scoreResults = await batchScoreProfileFit(supabase, roleId, profileIds, {
      maxRoles: options.limit,
      maxConcurrent: 5
    });

    for (const profileId of profileIds) {
      const profileData = profilesData[profileId];
      if (!profileData) {
        debug.errors.push({
          step: 'processing',
          error: `Missing profile data for ${profileId}`
        });
        continue;
      }

      const semanticMatch = profileMatches.find(m => m.id === profileId);
      const scoreResult = scoreResults.find(r => r.roleId === profileId);

      if (!semanticMatch || !scoreResult?.result.data) {
        debug.errors.push({
          step: 'processing',
          error: `Missing match data for ${profileId}`
        });
        continue;
      }

      const resultData = scoreResult.result.data;

      // Get capability and skill details from gaps analysis
      const [capabilityGaps, skillGaps] = await Promise.all([
        getCapabilityGaps(supabase, profileId, roleId),
        getSkillGaps(supabase, profileId, roleId)
      ]);

      const capabilityDetails = {
        matched: capabilityGaps.data?.filter(gap => gap.gapType === 'met').map(gap => gap.name) || [],
        missing: capabilityGaps.data?.filter(gap => gap.gapType === 'missing').map(gap => gap.name) || [],
        insufficient: capabilityGaps.data?.filter(gap => gap.gapType === 'insufficient').map(gap => gap.name) || []
      };

      const skillDetails = {
        matched: skillGaps.data?.filter(gap => gap.gapType === 'met').map(gap => gap.name) || [],
        missing: skillGaps.data?.filter(gap => gap.gapType === 'missing').map(gap => gap.name) || [],
        insufficient: skillGaps.data?.filter(gap => gap.gapType === 'insufficient').map(gap => gap.name) || []
      };

      matches.push({
        profileId,
        name: profileData.name,
        score: resultData.score,
        semanticScore: semanticMatch.similarity,
        summary: resultData.matchSummary || `Profile match score: ${resultData.score}%`,
        details: {
          capabilities: capabilityDetails,
          skills: skillDetails
        }
      });
    }

    debug.timings.processing = Date.now() - processStartTime;
    debug.counts.finalMatches = matches.length;

    // 5. Sort by combined score
    matches.sort((a, b) => {
      const scoreA = (a.score * 0.4) + (a.semanticScore * 0.6);
      const scoreB = (b.score * 0.4) + (b.semanticScore * 0.6);
      return scoreB - scoreA;
    });

    debug.timings.total = Date.now() - startTime;
    console.log('Hiring matches processing completed:', debug);

    return {
      matches: matches.slice(0, options.limit),
      debug
    };

  } catch (error) {
    console.error('Error in hiring matches processing:', error);
    debug.errors.push({ step: 'general', error });
    debug.timings.total = Date.now() - startTime;
    return { matches: [], debug };
  }
}

/**
 * Generate hiring insights using ChatGPT
 */
async function generateHiringInsights(
  matches: HiringMatch[],
  roleData: any,
  message?: string
): Promise<{ response: string; followUpQuestion?: string }> {
  try {
    const topMatches = matches.slice(0, 5);

    // Prepare the prompt for ChatGPT
    const prompt = `As an AI hiring advisor, analyze these candidate matches and provide insights for the hiring manager.

Role Requirements:
${roleData.title}
Required Capabilities: ${roleData.capabilities.map(c => c.name).join(', ')}
Required Skills: ${roleData.skills.map(s => s.name).join(', ')}

Top Candidates:
${topMatches.map(match => `
- ${match.name}
  Match Score: ${(match.score * 100).toFixed(1)}%
  Similarity: ${(match.semanticScore * 100).toFixed(1)}%
  Matched Capabilities: ${match.details.capabilities.matched.join(', ')}
  Capability Gaps: ${[...match.details.capabilities.missing, ...match.details.capabilities.insufficient].join(', ')}
  Matched Skills: ${match.details.skills.matched.join(', ')}
  Skill Gaps: ${[...match.details.skills.missing, ...match.details.skills.insufficient].join(', ')}`).join('\n')}

${message ? `Context from hiring manager: ${message}` : ''}

Please provide:
1. An overview of the candidate pool quality for this role
2. Specific insights about each top candidate's fit
3. Suggested interview focus areas based on identified gaps
4. Recommendations for next steps in the hiring process

Keep the tone professional and focus on actionable insights for the hiring manager.
Highlight both strengths and areas for further assessment.`;

    // Call ChatGPT API
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an AI hiring advisor providing detailed candidate analysis and recommendations. Focus on practical insights and next steps for hiring managers.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data = await response.json();
    const chatResponse = data.choices[0].message.content;

    // Generate follow-up question
    const followUpPrompt = `Based on this hiring analysis:

${chatResponse}

Generate a single, specific follow-up question that would help the hiring manager get more detailed information about the candidates or next steps. The question should be focused on making a hiring decision.

Response format: Just the question, no additional text.`;

    const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an AI hiring advisor. Generate a focused follow-up question for the hiring manager.'
          },
          {
            role: 'user',
            content: followUpPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      })
    });

    const followUpData = await followUpResponse.json();
    const followUpQuestion = followUpData.choices[0].message.content.trim();

    return {
      response: chatResponse,
      followUpQuestion
    };
  } catch (error) {
    console.error('Error generating hiring insights:', error);
    return {
      response: 'I encountered an error while analyzing the candidates. Please try again or contact support if the issue persists.',
      followUpQuestion: 'Would you like to focus on a specific aspect of the candidates\' qualifications?'
    };
  }
}

export async function runHiringLoop(
  supabase: SupabaseClient<Database>,
  request: MCPRequest
): Promise<MCPResponse> {
  try {
    const { roleId } = request;
    if (!roleId) {
      throw new Error('roleId is required for hiring loop');
    }

    // Get hiring matches using the new function
    const { matches, debug } = await getHiringMatches(supabase, roleId, {
      limit: 20,
      threshold: 0.5,
      maxConcurrent: 5
    });

    // Convert hiring matches to semantic matches format
    const semanticMatches: SemanticMatch[] = matches.map(match => ({
      id: match.profileId,
      similarity: match.semanticScore,
      type: 'profile',
      name: match.name,
      summary: match.summary,
      metadata: match.details
    }));

    // Log the MCP run
    await logAgentAction(supabase, {
      entityType: 'role',
      entityId: roleId,
      payload: {
        action: 'mcp_loop_complete',
        mode: 'hiring',
        matches: semanticMatches.slice(0, 10)
      },
      semanticMetrics: {
        similarityScores: {
          roleMatch: matches[0]?.semanticScore || 0,
          skillAlignment: matches[0]?.score || 0
        },
        matchingStrategy: 'hybrid',
        confidenceScore: 0.8
      }
    });

    // Determine next actions based on match results
    const nextActions: string[] = matches.length > 0 
      ? [
          'Review top candidate profiles',
          'Schedule interviews',
          'Assess skill gaps'
        ]
      : [
          'Broaden search criteria',
          'Review role requirements',
          'Consider alternative roles'
        ];

    return {
      success: true,
      message: 'Hiring loop completed successfully',
      data: {
        matches: semanticMatches,
        recommendations: matches.map(match => ({
          type: 'candidate_match',
          score: match.score,
          semanticScore: match.semanticScore,
          summary: match.summary,
          details: match.details
        })),
        actionsTaken: [],
        nextActions
      }
    };

  } catch (error) {
    console.error('Error in hiring loop:', error);
    return {
      success: false,
      error: {
        type: 'HIRING_LOOP_ERROR',
        message: error.message,
        details: error
      }
    };
  }
} 