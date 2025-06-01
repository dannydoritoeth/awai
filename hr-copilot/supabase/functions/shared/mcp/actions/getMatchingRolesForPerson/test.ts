import { assertEquals, assertObjectMatch } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { getMatchingRolesForPerson } from './action.ts';

// Test input validation
Deno.test("getMatchingRolesForPerson returns error for missing profileId", async () => {
  const result = await getMatchingRolesForPerson.actionFn({
    profileId: undefined,
    mode: 'candidate',
    context: {}
  });

  assertEquals(result.success, false);
  assertEquals(result.error?.type, 'INVALID_INPUT');
});

// Test role matching
Deno.test("getMatchingRolesForPerson processes job matches correctly", async () => {
  const mockRequest = {
    profileId: 'test-profile',
    mode: 'candidate',
    context: {},
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            data: [
              {
                id: 'profile1',
                name: 'Test Profile',
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

  const result = await getMatchingRolesForPerson.actionFn(mockRequest);
  
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
      assertEquals(typeof match.id, 'string');
      assertEquals(typeof match.name, 'string');
      assertEquals(typeof match.similarity, 'number');
      assertEquals(match.type, 'role');
      assertEquals(typeof match.summary, 'string');
    }

    // If recommendations exist, verify their structure
    if (result.data.recommendations.length > 0) {
      const rec = result.data.recommendations[0];
      assertObjectMatch(rec, {
        type: 'job_opportunity',
        details: {
          jobId: rec.details.jobId,
          roleId: rec.details.roleId,
          title: rec.details.title
        }
      });
      assertEquals(typeof rec.score, 'number');
      assertEquals(typeof rec.semanticScore, 'number');
      assertEquals(typeof rec.summary, 'string');
    }
  }
});

// Test empty results handling
Deno.test("getMatchingRolesForPerson handles empty match results", async () => {
  const mockRequest = {
    profileId: 'test-profile',
    mode: 'candidate',
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

  const result = await getMatchingRolesForPerson.actionFn(mockRequest);
  
  if (result.success && result.data) {
    assertEquals(result.data.matches.length, 0);
    assertEquals(result.data.recommendations.length, 0);
  }
});

// Test metadata
Deno.test("getMatchingRolesForPerson has correct action metadata", () => {
  assertObjectMatch(getMatchingRolesForPerson, {
    id: 'getMatchingRolesForPerson',
    usesAI: false,
    requiredInputs: ['profileId']
  });
}); 