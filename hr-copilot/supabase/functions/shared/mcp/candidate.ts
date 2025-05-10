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
import { logAgentResponse } from '../chatUtils.ts';
import { buildSafePrompt } from './promptBuilder.ts';

/**
 * Generate candidate insights using ChatGPT
 */
async function generateCandidateInsights(
  matches: SemanticMatch[],
  recommendations: any[],
  profileData: any,
  message?: string
): Promise<{ response: string; followUpQuestion?: string; prompt: string }> {
  try {
    if (!matches || matches.length === 0) {
      return {
        response: "No matching opportunities found to analyze.",
        followUpQuestion: "Would you like to adjust the search criteria?",
        prompt: "No matches to analyze"
      };
    }

    const systemPrompt = 'You are an AI career advisor providing detailed, personalized job recommendations and career advice. Focus on actionable insights and practical steps.';

    const promptData = {
      systemPrompt,
      userMessage: message || 'Please analyze the opportunities and provide career recommendations.',
      data: {
        profile: profileData,
        matches: matches.slice(0, 5),
        recommendations: recommendations.slice(0, 5)
      },
      context: {
        sections: [
          'PROFILE OVERVIEW',
          'OPPORTUNITY ANALYSIS',
          'SKILL GAP ASSESSMENT',
          'CAREER PATH RECOMMENDATIONS',
          'NEXT STEPS'
        ]
      }
    };

    const promptOptions = {
      maxItems: 5,
      maxFieldLength: 200,
      priorityFields: ['name', 'title', 'summary', 'score', 'semanticScore'],
      excludeFields: ['metadata', 'raw_data', 'embedding']
    };

    const prompt = buildSafePrompt('openai:gpt-4-turbo-preview', promptData, promptOptions);

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
            content: prompt.system
          },
          {
            role: 'user',
            content: prompt.user
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
      followUpQuestion: parts[1]?.trim(),
      prompt: prompt.user // Return the actual prompt used
    };

  } catch (error) {
    console.error('Error generating candidate insights:', error);
    return {
      response: 'I encountered an error while analyzing the opportunities. Please try again or contact support if the issue persists.',
      followUpQuestion: 'Would you like me to focus on specific aspects of your career interests?',
      prompt: 'Error occurred while generating prompt'
    };
  }
}

export async function runCandidateLoop(
  supabase: SupabaseClient<Database>,
  request: MCPRequest
): Promise<MCPResponse> {
  try {
    const { profileId, context, sessionId } = request;
    const matches: SemanticMatch[] = [];
    const recommendations: any[] = [];

    // Log starting analysis
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "I'm analyzing your profile and finding the best role matches for your skills...",
        'mcp_analysis_start'
      );
    }

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

    // Log profile data loaded
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        "I've loaded your profile data and am now looking for matching opportunities...",
        'mcp_data_loaded'
      );
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

      // Log matches found
      if (sessionId) {
        await logAgentResponse(
          supabase,
          sessionId,
          `I've found ${matches.length} potential role matches. Analyzing them in detail...`,
          'mcp_matches_found'
        );
      }
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

    // Log the final AI response to chat
    if (sessionId) {
      await logAgentResponse(
        supabase,
        sessionId,
        chatResponse.response,
        'mcp_final_response',
        undefined,
        {
          matches: matches.slice(0, 5),
          recommendations: recommendations.slice(0, 3),
          followUpQuestion: chatResponse.followUpQuestion
        }
      );
    }

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

    // Return CandidateMCPResponse with profile data included
    return {
      success: true,
      message: 'Candidate loop completed successfully',
      data: {
        matches: matches.slice(0, 10),
        recommendations: recommendations.slice(0, 5),
        chatResponse: {
          message: chatResponse.response,
          followUpQuestion: chatResponse.followUpQuestion,
          aiPrompt: chatResponse.prompt
        },
        nextActions: [
          'Review suggested career paths',
          'Explore job opportunities',
          'Focus on closing identified skill gaps'
        ],
        actionsTaken: [
          'Retrieved profile data',
          'Analyzed skill matches',
          'Generated career recommendations',
          'Completed candidate analysis'
        ],
        profile: profileData
      }
    } as CandidateMCPResponse;

  } catch (error) {
    // Log error to chat if we have a session
    if (request.sessionId) {
      await logAgentResponse(
        supabase,
        request.sessionId,
        "I encountered an error while analyzing your profile. Let me know if you'd like to try again.",
        'mcp_error'
      );
    }

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