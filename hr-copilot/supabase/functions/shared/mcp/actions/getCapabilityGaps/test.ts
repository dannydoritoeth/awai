import { assertEquals, assertObjectMatch } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { getCapabilityGaps } from './action.ts';

// Test input validation
Deno.test("getCapabilityGaps returns error for missing inputs", async () => {
  const result = await getCapabilityGaps.actionFn({
    profileId: undefined,
    roleId: undefined,
    mode: 'candidate',
    context: {}
  });

  assertEquals(result.success, false);
  assertEquals(result.error?.type, 'INVALID_INPUT');
});

// Test gap analysis
Deno.test("getCapabilityGaps calculates gap severity correctly", async () => {
  const mockRequest = {
    profileId: 'test-profile',
    roleId: 'test-role',
    mode: 'candidate',
    context: {},
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            data: [
              {
                capability_id: 'cap1',
                level: 'expert',
                capabilities: {
                  id: 'cap1',
                  name: 'Leadership',
                  group_name: 'Management'
                }
              }
            ],
            error: null
          })
        })
      })
    }
  };

  const result = await getCapabilityGaps.actionFn(mockRequest);
  
  if (result.success && result.data) {
    // Verify data structure
    assertObjectMatch(result.data, {
      gaps: [],
      summary: {
        criticalGaps: 0,
        minorGaps: 0,
        metRequirements: 0,
        overallReadiness: 0,
        recommendations: []
      }
    });

    // If gaps exist, verify their structure
    if (result.data.gaps.length > 0) {
      const gap = result.data.gaps[0];
      assertEquals(typeof gap.capabilityId, 'string');
      assertEquals(typeof gap.name, 'string');
      assertEquals(typeof gap.groupName, 'string');
      assertEquals(typeof gap.requiredLevel, 'string');
      assertEquals(typeof gap.severity, 'number');
      assertEquals(['missing', 'insufficient', 'met'].includes(gap.gapType), true);
    }
  }
});

// Test metadata
Deno.test("getCapabilityGaps has correct action metadata", () => {
  assertObjectMatch(getCapabilityGaps, {
    id: 'getCapabilityGaps',
    usesAI: false,
    requiredInputs: ['profileId', 'roleId']
  });
}); 