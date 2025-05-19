import { describe, it, expect } from 'vitest';
import { getMatchingRolesForPerson } from './action';

describe('getMatchingRolesForPerson', () => {
  describe('input validation', () => {
    it('should return error for missing profileId', async () => {
      const result = await getMatchingRolesForPerson.actionFn({
        profileId: undefined,
        mode: 'candidate',
        context: {}
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('INVALID_INPUT');
    });
  });

  describe('role matching', () => {
    it('should process job matches correctly', async () => {
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
        expect(result.data).toMatchObject({
          matches: expect.any(Array),
          recommendations: expect.any(Array),
          nextActions: expect.any(Array)
        });

        // Validate match structure
        if (result.data.matches.length > 0) {
          expect(result.data.matches[0]).toMatchObject({
            id: expect.any(String),
            name: expect.any(String),
            similarity: expect.any(Number),
            type: 'role',
            summary: expect.any(String)
          });
        }

        // Validate recommendation structure
        if (result.data.recommendations.length > 0) {
          expect(result.data.recommendations[0]).toMatchObject({
            type: 'job_opportunity',
            score: expect.any(Number),
            semanticScore: expect.any(Number),
            summary: expect.any(String),
            details: {
              jobId: expect.any(String),
              roleId: expect.any(String),
              title: expect.any(String)
            }
          });
        }
      }
    });

    it('should handle empty match results', async () => {
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
        expect(result.data.matches).toHaveLength(0);
        expect(result.data.recommendations).toHaveLength(0);
      }
    });
  });

  describe('metadata', () => {
    it('should have correct action metadata', () => {
      expect(getMatchingRolesForPerson).toMatchObject({
        id: 'getMatchingRolesForPerson',
        usesAI: false,
        requiredInputs: ['profileId']
      });
    });
  });
}); 