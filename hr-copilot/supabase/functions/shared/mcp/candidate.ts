import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { MCPRequest, MCPResponse, SemanticMatch } from '../mcpTypes.ts';
import { getProfileContext } from '../profile/getProfileContext.ts';
import { getSuggestedCareerPaths } from '../profile/getSuggestedCareerPaths.ts';
// import { getRoleDetail } from '../role/getRoleDetail.ts';
import { getCapabilityGaps } from '../profile/getCapabilityGaps.ts';
import { getSkillGaps } from '../profile/getSkillGaps.ts';
import { getOpenJobs } from '../job/getOpenJobs.ts';
import { getJobReadiness } from '../job/getJobReadiness.ts';
import { logAgentAction } from '../agent/logAgentAction.ts';
import { getSemanticMatches } from '../embeddings.ts';
import { getProfileData } from '../profile/getProfileData.ts';
import { getRolesData } from '../role/getRoleData.ts';
import { calculateJobReadiness, generateJobSummary } from '../job/jobReadiness.ts';
import { testJobMatching } from '../job/testJobMatching.ts';

/**
 * Generate candidate insights using ChatGPT
 */
async function generateCandidateInsights(
  matches: SemanticMatch[],
  recommendations: any[],
  profileData: any,
  message?: string
): Promise<{ response: string; followUpQuestion?: string }> {
  try {
    // Get top matches and recommendations
    const topMatches = matches.slice(0, 3);
    const topRecommendations = recommendations.slice(0, 3);

    // Prepare data for ChatGPT analysis
    const matchData = topMatches.map(match => {
      const recommendation = topRecommendations.find(r => 
        r.details?.roleId === match.id || 
        r.details?.jobId === match.id
      );
      return {
        title: match.name,
        similarity: match.similarity,
        summary: match.summary,
        details: recommendation?.summary || '',
        score: recommendation?.score || 0
      };
    });

    // Collect all skills and capabilities
    const allSkills = new Set<string>();
    const allCapabilities = new Set<string>();
    
    topRecommendations.forEach(rec => {
      if (!rec.summary) return;
      
      const skillMatch = rec.summary.match(/Strong match in skills: ([^.]+)/);
      if (skillMatch) {
        skillMatch[1].split(', ').forEach(s => allSkills.add(s.trim()));
      }
      
      const skillGaps = rec.summary.match(/Skill gaps: ([^.]+)/);
      if (skillGaps) {
        skillGaps[1].split(', ').forEach(s => {
          const skill = s.replace(/\s*\([^)]*\)/, '').trim();
          allSkills.add(skill);
        });
      }
      
      const capabilityGaps = rec.summary.match(/Capability gaps: ([^.]+)/);
      if (capabilityGaps) {
        capabilityGaps[1].split(', ').forEach(c => {
          const capability = c.replace(/\s*\([^)]*\)/, '').trim();
          allCapabilities.add(capability);
        });
      }
    });

    // Prepare the prompt for ChatGPT
    const prompt = `As an AI career advisor, analyze this candidate's profile and potential opportunities.

CANDIDATE PROFILE
Name: ${profileData.name || 'Not specified'}
Current Role: ${profileData.role_title || 'Not specified'}
Division: ${profileData.division || 'Not specified'}
Experience Level: ${profileData.experience_level || 'Not specified'}
Key Skills: ${profileData.skills?.map(s => s.name).join(', ') || 'Not specified'}
Key Capabilities: ${profileData.capabilities?.map(c => c.name).join(', ') || 'Not specified'}

Available Roles:
${matchData.map(match => `
- ${match.title}
  Match Score: ${(match.score * 100).toFixed(1)}%
  Similarity: ${(match.similarity * 100).toFixed(1)}%
  Details: ${match.details}`).join('\n')}

Skills identified:
${Array.from(allSkills).map(skill => `- ${skill}`).join('\n')}

Capabilities needed:
${Array.from(allCapabilities).map(cap => `- ${cap}`).join('\n')}

${message ? `User's message: ${message}` : ''}

Please provide:
1. A brief overview of how the candidate's profile aligns with these roles
2. Specific insights about each role's requirements and how they match the candidate's experience
3. Practical advice on how to leverage existing skills and develop new ones
4. A relevant follow-up question to help explore further

Keep the tone conversational and focus on actionable insights rather than technical scores.
Ensure the response is detailed and insightful, highlighting specific aspects of each role.
If there are skill or capability gaps, provide specific suggestions for addressing them.`;

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
            content: 'You are an AI career advisor providing detailed, personalized job recommendations and career advice. Focus on actionable insights and practical steps.'
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

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ChatGPT API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from ChatGPT API');
    }

    const chatResponse = data.choices[0].message.content;

    // Split response into main content and follow-up question
    const parts = chatResponse.split(/\n\nFollow-up question:/i);
    return {
      response: parts[0].trim(),
      followUpQuestion: parts[1]?.trim()
    };

  } catch (error) {
    console.error('Error generating candidate insights:', error);
    return {
      response: 'I encountered an error while analyzing the opportunities. Please try again or contact support if the issue persists.',
      followUpQuestion: 'Would you like me to focus on specific aspects of your career interests?'
    };
  }
}

export async function runCandidateLoop(
  supabase: SupabaseClient<Database>,
  request: MCPRequest
): Promise<MCPResponse> {
  try {
    const { profileId, context } = request;
    const matches: SemanticMatch[] = [];
    const recommendations: any[] = [];

    // Get profile context with embedding
    const profileContext = await getProfileContext(supabase, profileId!);
    if (profileContext.error) {
      throw new Error(`Failed to get profile context: ${profileContext.error.message}`);
    }

    // Get profile data
    const profileData = await getProfileData(supabase, profileId!);
    if (!profileData) {
      throw new Error('Failed to get profile data');
    }

    // Get open jobs with semantic matching
    const jobMatchingResult = await testJobMatching(supabase, profileId!, {
      limit: 20,
      threshold: 0.7
    });

    // Add job matches to the response
    if (jobMatchingResult.matches.length > 0) {
      matches.push(...jobMatchingResult.matches.map(match => ({
        id: match.roleId,
        name: match.jobTitle,
        similarity: match.semanticScore,
        type: 'role' as const,
        summary: match.summary
      })));

      recommendations.push(...jobMatchingResult.matches.map(match => ({
        type: 'job_opportunity',
        score: match.score,
        semanticScore: match.semanticScore,
        summary: match.summary,
        details: {
          jobId: match.jobId,
          roleId: match.roleId,
          title: match.jobTitle
        }
      })));
    }

    // Sort recommendations by combined score
    recommendations.sort((a, b) => {
      const scoreA = (a.score * 0.4) + (a.semanticScore * 0.6);
      const scoreB = (b.score * 0.4) + (b.semanticScore * 0.6);
      return scoreB - scoreA;
    });

    // Generate insights using ChatGPT
    const chatResponse = await generateCandidateInsights(
      matches,
      recommendations,
      profileData,
      context?.lastMessage
    );

    // Log the MCP run
    await logAgentAction(supabase, {
      entityType: 'profile',
      entityId: profileId!,
      payload: {
        action: 'mcp_loop_complete',
        mode: 'candidate',
        recommendations: recommendations.slice(0, 5),
        matches: matches.slice(0, 10)
      },
      semanticMetrics: {
        similarityScores: {
          roleMatch: matches.find(m => m.type === 'role')?.similarity,
          skillAlignment: matches.find(m => m.type === 'skill')?.similarity,
          capabilityAlignment: matches.find(m => m.type === 'capability')?.similarity
        },
        matchingStrategy: 'hybrid',
        confidenceScore: 0.8
      }
    });

    return {
      success: true,
      message: 'Candidate loop completed successfully',
      data: {
        matches: matches.slice(0, 10),
        recommendations: recommendations.slice(0, 5),
        chatResponse: {
          message: chatResponse.response,
          followUpQuestion: chatResponse.followUpQuestion
        },
        nextActions: [
          'Review suggested career paths',
          'Explore job opportunities',
          'Focus on closing identified skill gaps'
        ]
      }
    };

  } catch (error) {
    return {
      success: false,
      message: error.message,
      error: {
        type: 'PLANNER_ERROR',
        message: 'Failed to run candidate loop',
        details: error
      }
    };
  }
} 