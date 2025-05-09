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
  roleData: RoleData,
  message?: string
): Promise<{ response: string; followUpQuestion?: string }> {
  try {
    const topMatches = matches.slice(0, 5);

    // Calculate aggregate statistics for candidate pool
    const avgScore = topMatches.reduce((sum, m) => sum + m.score, 0) / topMatches.length;
    const avgCapabilityMatch = topMatches.reduce((sum, m) => {
      const capabilities = m.details?.capabilities || [];
      const missingCapabilities = m.details?.missingCapabilities || [];
      const total = capabilities.length + missingCapabilities.length;
      return sum + (total > 0 ? (capabilities.length / total) * 100 : 0);
    }, 0) / topMatches.length;

    // Prepare the prompt for ChatGPT
    const prompt = `As a hiring advisor, provide a detailed analysis for the hiring manager.

ROLE DETAILS
Title: ${roleData.title}
Grade Band: ${roleData.gradeBand || 'Not specified'}
Location: ${roleData.location || 'Not specified'}
Division: ${roleData.divisionId || 'Not specified'}

Primary Purpose:
${roleData.primaryPurpose || 'Not specified'}

Reporting Structure:
- Reports to: ${roleData.reportingLine || 'Not specified'}
- Direct Reports: ${roleData.directReports || 'None'}
- Budget Responsibility: ${roleData.budgetResponsibility || 'None'}

Required Capabilities:
${roleData.capabilities.map(c => `- ${c.name} (Level ${c.required_level})${c.capabilityType ? ` [${c.capabilityType}]` : ''}`).join('\n')}

Required Skills:
${roleData.skills.map(s => `- ${s.name} (Level ${s.required_level}, ${s.required_years}+ years)`).join('\n')}

CANDIDATE POOL METRICS
- Number of Candidates: ${topMatches.length}
- Average Match Score: ${avgScore.toFixed(1)}%
- Average Capability Alignment: ${avgCapabilityMatch.toFixed(1)}%

TOP CANDIDATES:
${topMatches.map(match => `
Candidate: ${match.name}
Overall Match: ${(match.score * 100).toFixed(1)}%
Strong Areas:
- Capabilities: ${match.details?.capabilities?.join(', ') || 'None'}
- Skills: ${match.details?.skills?.join(', ') || 'None'}
Development Areas:
- Missing Capabilities: ${match.details?.missingCapabilities?.join(', ') || 'None'}
- Missing Skills: ${match.details?.missingSkills?.join(', ') || 'None'}`).join('\n')}

${message ? `Additional Context: ${message}` : ''}

Please provide a comprehensive hiring analysis with the following sections:

1. ROLE REQUIREMENTS OVERVIEW
- Key capabilities and skills needed for success
- Critical requirements vs. nice-to-have
- Impact of the role within the organization

2. CANDIDATE POOL QUALITY
- Overall assessment of candidate pool
- Distribution of skills and capabilities
- Areas where candidates are strong/weak as a group
- Diversity of experience and backgrounds

3. INDIVIDUAL CANDIDATE ASSESSMENTS
For each candidate:
- Key strengths and alignment with role requirements
- Specific gaps and development needs
- Risk assessment and growth potential
- Cultural fit considerations

4. INTERVIEW RECOMMENDATIONS
For each candidate:
- Specific areas to probe based on their profile
- Technical assessment focus areas
- Leadership and management capability assessment
- Sample questions to assess gap areas
- Suggested interview panel composition

5. HIRING RECOMMENDATIONS
- Priority candidates to focus on
- Suggested next steps in hiring process
- Risk mitigation strategies
- Timeline recommendations
- Onboarding considerations

Keep the analysis objective and data-driven, focusing on actionable insights for the hiring manager.
Highlight both immediate fit and long-term potential.
If there are concerning gaps, be direct about their impact on role success.`;

    // Log the prompt to agent_actions
    await logAgentAction(supabase, {
      entityType: 'role',
      entityId: roleData.id,
      payload: {
        action: 'generate_hiring_insights',
        prompt,
        candidateCount: topMatches.length,
        avgScore,
        avgCapabilityMatch
      }
    });

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

    const data = await response.json();
    const chatResponse = data.choices[0].message.content;

    // Generate follow-up question focused on hiring decision
    const followUpPrompt = `Based on this hiring analysis:

${chatResponse}

Generate a single, specific follow-up question that would help the hiring manager make a better hiring decision. Focus on:
1. Comparing top candidates
2. Assessing specific risks
3. Validating key capabilities
4. Timeline considerations
5. Interview strategy

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
            content: 'You are an AI hiring advisor. Generate a focused follow-up question to help the hiring manager make a better hiring decision.'
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
      followUpQuestion: 'Would you like me to focus on specific aspects of the candidates\' qualifications?'
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
    const semanticMatches: SemanticMatch[] = matches.map(match => {
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

    // Return response with linked matches, recommendations, and role details
    return {
      success: true,
      message: 'Hiring loop completed successfully',
      data: {
        matches: semanticMatches,
        recommendations: matches.map(match => {
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
        actionsTaken: [
          'Retrieved role data',
          'Analyzed candidate matches',
          'Generated hiring recommendations',
          'Completed hiring analysis'
        ],
        nextActions: matches.length > 0 
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