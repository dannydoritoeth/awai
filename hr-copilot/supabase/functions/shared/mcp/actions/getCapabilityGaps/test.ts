import { describe, it, expect } from 'vitest';
import { getCapabilityGaps } from './action';

describe('getCapabilityGaps', () => {
  describe('input validation', () => {
    it('should return error for missing inputs', async () => {
      const result = await getCapabilityGaps.actionFn({
        profileId: undefined,
        roleId: undefined,
        mode: 'candidate',
        context: {}
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('INVALID_INPUT');
    });
  });

  describe('gap analysis', () => {
    it('should calculate gap severity correctly', async () => {
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
        expect(result.data).toMatchObject({
          gaps: expect.any(Array),
          summary: {
            criticalGaps: expect.any(Number),
            minorGaps: expect.any(Number),
            metRequirements: expect.any(Number),
            overallReadiness: expect.any(Number),
            recommendations: expect.any(Array)
          }
        });

        // Validate gap structure
        if (result.data.gaps.length > 0) {
          expect(result.data.gaps[0]).toMatchObject({
            capabilityId: expect.any(String),
            name: expect.any(String),
            groupName: expect.any(String),
            requiredLevel: expect.any(String),
            severity: expect.any(Number),
            gapType: expect.stringMatching(/^(missing|insufficient|met)$/)
          });
        }
      }
    });
  });

  describe('metadata', () => {
    it('should have correct action metadata', () => {
      expect(getCapabilityGaps).toMatchObject({
        id: 'getCapabilityGaps',
        usesAI: false,
        requiredInputs: ['profileId', 'roleId']
      });
    });
  });
}); 