import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { MCPRequest, MCPResponse, SemanticMatch, PlannerRecommendation } from '../mcpTypes.ts';
import { getSemanticMatches } from '../embeddings.ts';
import { getCapabilityGaps } from '../profile/getCapabilityGaps.ts';
import { getSkillGaps } from '../profile/getSkillGaps.ts';
import { batchScoreProfileFit } from '../agent/scoreProfileFit.ts';
import { getRoleDetail } from '../role/getRoleDetail.ts';
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

interface RoleData {
  id: string;
  title: string;
  divisionId?: string;
  gradeBand?: string;
  location?: string;
  primaryPurpose?: string;
  reportingLine?: string;
  directReports?: string;
  budgetResponsibility?: string;
  capabilities: Array<{ 
    name: string; 
    required_level: number;
    capabilityType?: string;
  }>;
  skills: Array<{ 
    name: string; 
    required_level: number;
    required_years: number;
  }>;
}

interface CapabilityDetails {
  matched: string[];
  missing: string[];
  insufficient: string[];
}

interface SkillDetails {
  matched: string[];
  missing: string[];
  insufficient: string[];
}

interface CandidateDetails {
  capabilities: CapabilityDetails;
  skills: SkillDetails;
}

interface HiringMatchDetails {
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

interface HiringMatch extends HiringMatch {
  details: HiringMatchDetails;
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
    const profileIds = profileMatches?.map(match => match.id);
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
  roleData: RoleData,
  message?: string
): Promise<{ response: string; followUpQuestion?: string; prompt: string }> {
  try {
    if (!matches || matches.length === 0) {
      return {
        response: "No matching candidates found to analyze.",
        followUpQuestion: "Would you like to adjust the search criteria?",
        prompt: "No candidates to analyze"
      };
    }

    // Prepare the prompt with raw JSON data
    const prompt = `As a hiring advisor, analyze the following role and candidates.

Schema hint:
Role contains title, purpose, capabilities (focus/complementary), skills (level + years).
Each candidate contains name, scores, matched/missing skills and capabilities.

${message || 'Please analyze the candidates for this role and provide hiring recommendations.'}

${JSON.stringify({ 
  role: roleData, 
  candidates: matches.slice(0, 5)  // Only take top 5 candidates
}, null, 2)}

Please provide a comprehensive hiring analysis with the following sections:

1. ROLE REQUIREMENTS OVERVIEW
2. CANDIDATE POOL QUALITY
3. INDIVIDUAL CANDIDATE ASSESSMENTS
4. INTERVIEW RECOMMENDATIONS
5. HIRING RECOMMENDATIONS

Keep the analysis objective and data-driven, focusing on actionable insights for the hiring manager.`;

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
            content: 'You are an experienced technical hiring advisor helping a hiring manager evaluate candidates. Focus on providing clear, actionable insights based on candidate skills, capabilities, and potential. Be direct about both strengths and concerns.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate insights from OpenAI API');
    }

    const data = await response.json();
    const chatResponse = data.choices?.[0]?.message?.content;

    if (!chatResponse) {
      throw new Error('Invalid response format from OpenAI API');
    }

    return {
      response: chatResponse,
      followUpQuestion: "Would you like to focus on any specific aspects of these candidates?",
      prompt
    };

  } catch (error) {
    console.error('Error generating hiring insights:', error);
    return {
      response: 'I encountered an error while analyzing the candidates. Please try again or contact support if the issue persists.',
      followUpQuestion: 'Would you like me to focus on specific aspects of the candidates\' qualifications?',
      prompt: 'Error occurred while generating prompt'
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

    // Get role details
    const roleDetail = await getRoleDetail(supabase, roleId);
    if (!roleDetail) {
      throw new Error('Failed to load role details');
    }

    // Get hiring matches using the new function
    const { matches, debug } = await getHiringMatches(supabase, roleId, {
      limit: 20,
      threshold: 0.5,
      maxConcurrent: 5
    });

    // Convert hiring matches to semantic matches format with unique identifiers
    const semanticMatches: SemanticMatch[] = matches?.map(match => {
      const matchId = `${roleId}_${match.profileId}`;
      return {
        id: match.profileId,
        matchId,
        similarity: match.semanticScore,
        type: 'profile',
        name: match.name,
        summary: match.summary,
        metadata: match.details
      };
    });

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

    // Convert matches to the format expected by generateHiringInsights
    const processedMatches = matches?.map(match => {
      // Extract capabilities and skills from details
      const capabilities = {
        matched: match.details?.capabilities?.matched || [],
        missing: match.details?.capabilities?.missing || [],
        insufficient: match.details?.capabilities?.insufficient || []
      };
      
      const skills = {
        matched: match.details?.skills?.matched || [],
        missing: match.details?.skills?.missing || [],
        insufficient: match.details?.skills?.insufficient || []
      };

      return {
        profileId: match.profileId,
        name: match.name,
        score: match.score || 0,
        semanticScore: match.semanticScore || 0,
        details: {
          capabilities,
          skills
        }
      };
    });

    // Generate insights using ChatGPT
    const chatResponse = await generateHiringInsights(
      processedMatches || [],
      roleDetail,
      request.context?.lastMessage
    );

    // Return response with linked matches, recommendations, and role details
    return {
      success: true,
      message: 'Hiring loop completed successfully',
      data: {
        matches: semanticMatches,
        recommendations: matches?.map(match => {
          const matchId = `${roleId}_${match.profileId}`;
          return {
            type: 'candidate_match',
            matchId,
            profileId: match.profileId,
            score: match.score,
            semanticScore: match.semanticScore,
            summary: match.summary,
            details: match.details
          };
        }),
        chatResponse: chatResponse ? {
          message: chatResponse.response || "No insights generated",
          followUpQuestion: chatResponse.followUpQuestion || "Would you like to analyze specific aspects of the candidates?",
          aiPrompt: chatResponse.prompt
        } : {
          message: "Failed to generate hiring insights",
          followUpQuestion: "Would you like to try analyzing the candidates again?",
          aiPrompt: null
        },
        actionsTaken: [
          'Retrieved role data',
          'Analyzed candidate matches',
          'Generated hiring recommendations',
          chatResponse ? 'Generated hiring insights' : 'Attempted to generate hiring insights',
          'Completed hiring analysis'
        ],
        nextActions: matches?.length > 0 
          ? [
              'Review top candidate profiles',
              'Schedule interviews',
              'Assess skill gaps'
            ]
          : [
              'Broaden search criteria',
              'Review role requirements',
              'Consider alternative roles'
            ],
        role: roleDetail
      }
    } as HiringMCPResponse;

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