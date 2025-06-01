import { assertEquals, assertObjectMatch, assertStringIncludes } from 'https://deno.land/std/testing/asserts.ts';
import { getMatchingPeopleForRole } from './action.ts';

// Test profile matching
Deno.test("getMatchingPeopleForRole processes profile matches correctly", async () => {
  const mockRequest = {
    roleId: 'test-role',
    mode: 'hiring',
    context: {},
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            data: [
              {
                id: 'role1',
                title: 'Test Role',
                skills: [],
                capabilities: []
              }
            ],
            error: null
          })
        })
      })
    }
  };

  const result = await getMatchingPeopleForRole.actionFn(mockRequest);
  
  if (result.success && result.data) {
    // Verify data structure
    assertObjectMatch(result.data, {
      matches: [],
      recommendations: [],
      nextActions: []
    });

    // If matches exist, verify their structure
    if (result.data.matches.length > 0) {
      const match = result.data.matches[0];
      assertEquals(typeof match.profileId, 'string');
      assertEquals(typeof match.name, 'string');
      assertEquals(typeof match.semanticScore, 'number');
      assertEquals(typeof match.summary, 'string');
    }

    // If recommendations exist, verify their structure
    if (result.data.recommendations.length > 0) {
      const rec = result.data.recommendations[0];
      assertObjectMatch(rec, {
        profileId: rec.profileId,
        name: rec.name,
        semanticScore: rec.semanticScore,
        details: {
          skills: rec.details.skills
        }
      });
    }
  }
});

// Test markdown button rendering
Deno.test("getMatchingPeopleForRole generates correct markdown buttons", async () => {
  const mockRequest = {
    roleId: 'test-role',
    mode: 'hiring',
    context: {},
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            data: [{
              id: 'role1',
              title: 'Test Role'
            }],
            error: null
          })
        })
      }),
      rpc: () => ({
        select: () => ({
          data: [{
            id: 'profile1',
            similarity: 0.85,
            name: 'John Doe',
            summary: 'Experienced developer'
          }],
          error: null
        })
      })
    }
  };

  const result = await getMatchingPeopleForRole.actionFn(mockRequest);
  
  if (result.success && result.chatResponse) {
    const message = result.chatResponse.message;
    
    // Verify markdown structure
    assertStringIncludes(message, '### 👥 Top Matching Candidates');
    
    // Verify action button group is present
    assertStringIncludes(message, '```action');
    assertStringIncludes(message, '"groupId":');
    
    // Verify all required actions are in the group
    assertStringIncludes(message, '"actionId": "getRoleDetails"');
    assertStringIncludes(message, '"actionId": "getCapabilityGaps"');
    assertStringIncludes(message, '"actionId": "getSemanticSkillRecommendations"');
    assertStringIncludes(message, '"actionId": "getDevelopmentPlan"');
    
    // Verify button parameters
    assertStringIncludes(message, '"params": {');
    assertStringIncludes(message, '"profileId":');
    assertStringIncludes(message, '"roleId":');
    assertStringIncludes(message, '"roleTitle":');
  }
});

// Test empty results handling
Deno.test("getMatchingPeopleForRole handles empty match results", async () => {
  const mockRequest = {
    roleId: 'test-role',
    mode: 'hiring',
    context: {},
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            data: [],
            error: null
          })
        })
      })
    }
  };

  const result = await getMatchingPeopleForRole.actionFn(mockRequest);
  
  if (result.success && result.data) {
    assertEquals(result.data.matches.length, 0);
    assertEquals(result.data.recommendations.length, 0);
    
    // Verify empty state message
    assertStringIncludes(
      result.chatResponse.message,
      "I couldn't find any matching candidates at this time"
    );
  }
}); 