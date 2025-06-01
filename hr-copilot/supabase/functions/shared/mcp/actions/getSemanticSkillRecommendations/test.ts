import { assertEquals, assertExists } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { buildSkillRecommendationsPrompt } from './buildPrompt.ts';
import { getSemanticSkillRecommendations } from './action.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { MCPRequest } from '../../types/action.ts';

// Mock Supabase client for testing
function createMockSupabaseClient(mockData?: any) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          data: mockData?.[table] || [],
          error: null
        })
      })
    })
  } as any;
}

Deno.test('buildSkillRecommendationsPrompt - generates valid prompt', () => {
  const context = {
    currentSkills: [
      { name: 'JavaScript', level: 3 },
      { name: 'TypeScript', level: 2 }
    ],
    roleSkills: [
      { name: 'JavaScript', requiredLevel: 4 },
      { name: 'React', requiredLevel: 3 }
    ],
    semanticRecommendations: [
      { name: 'Node.js', relevance: 0.85, description: 'Backend JavaScript runtime' },
      { name: 'Next.js', relevance: 0.75 }
    ]
  };

  const prompt = buildSkillRecommendationsPrompt(context);

  assertExists(prompt.system);
  assertExists(prompt.user);
  assertEquals(typeof prompt.system, 'string');
  assertEquals(typeof prompt.user, 'string');
  
  // Check that prompt includes key context
  const userPrompt = prompt.user;
  assertEquals(userPrompt.includes('JavaScript (Level 3)'), true);
  assertEquals(userPrompt.includes('TypeScript (Level 2)'), true);
  assertEquals(userPrompt.includes('JavaScript (Required Level 4)'), true);
  assertEquals(userPrompt.includes('React (Required Level 3)'), true);
  assertEquals(userPrompt.includes('Node.js (Relevance: 85.0%)'), true);
  assertEquals(userPrompt.includes('Next.js (Relevance: 75.0%)'), true);
});

Deno.test('buildSkillRecommendationsPrompt - validates required context', () => {
  const invalidContext = {
    currentSkills: [],
    roleSkills: undefined,
    semanticRecommendations: []
  };

  try {
    buildSkillRecommendationsPrompt(invalidContext as any);
    throw new Error('Should have thrown validation error');
  } catch (error) {
    assertEquals(error.message, 'Missing required context for skill recommendations prompt');
  }
});

Deno.test('getSemanticSkillRecommendations - validates required inputs', async () => {
  const mockSupabase = createMockSupabaseClient();
  
  const invalidRequest: MCPRequest = {
    supabase: mockSupabase,
    profileId: '',
    roleId: '',
    mode: 'candidate'
  };

  const result = await getSemanticSkillRecommendations.actionFn(invalidRequest);
  assertEquals(result.success, false);
  assertEquals(result.error?.type, 'INVALID_INPUT');
});

Deno.test('getSemanticSkillRecommendations - handles successful flow', async () => {
  const mockSupabase = createMockSupabaseClient({
    profile_skills: [
      { id: '1', name: 'JavaScript', level: 3 },
      { id: '2', name: 'TypeScript', level: 2 }
    ],
    role_skills: [
      { id: '1', name: 'JavaScript', required_level: 4 },
      { id: '2', name: 'React', required_level: 3 }
    ]
  });

  const request: MCPRequest = {
    supabase: mockSupabase,
    profileId: 'test-profile',
    roleId: 'test-role',
    mode: 'candidate'
  };

  const result = await getSemanticSkillRecommendations.actionFn(request);
  assertEquals(result.success, true);
  assertExists(result.data);
  assertEquals(Array.isArray(result.data.recommendations), true);
  assertEquals(typeof result.data.explanation, 'string');
}); 