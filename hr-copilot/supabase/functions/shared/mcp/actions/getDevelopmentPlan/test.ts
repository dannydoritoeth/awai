import { describe, it, expect } from 'vitest';
import { buildDevelopmentPlanPrompt } from './buildPrompt';
import { getDevelopmentPlan } from './action';

describe('getDevelopmentPlan', () => {
  describe('buildDevelopmentPlanPrompt', () => {
    it('should build a valid prompt from AI context', () => {
      const mockAIContext = {
        profile: {
          skills: [
            { name: 'JavaScript', currentLevel: 3, years: 2 },
            { name: 'Python', currentLevel: 4, years: 3 }
          ],
          capabilities: [
            { name: 'Problem Solving', currentLevel: 4 },
            { name: 'Communication', currentLevel: 3 }
          ]
        },
        targetRole: {
          title: 'Senior Developer',
          requirements: ['Strong programming skills', 'Leadership experience']
        },
        gaps: {
          capabilities: [
            { name: 'Leadership', severity: 70, gapType: 'insufficient' }
          ],
          skills: [
            { name: 'System Design', gap: 2, priority: 'high' }
          ]
        },
        potentialMentors: [
          {
            id: 'mentor1',
            name: 'John Doe',
            title: 'Tech Lead',
            expertise: ['Architecture', 'Mentoring'],
            similarity: 0.85
          }
        ]
      };

      const prompt = buildDevelopmentPlanPrompt(mockAIContext);
      expect(prompt).toMatchSnapshot();
      expect(prompt.system).toBeDefined();
      expect(prompt.user).toBeDefined();
    });
  });

  describe('action output validation', () => {
    it('should return error for missing inputs', async () => {
      const result = await getDevelopmentPlan.actionFn({
        profileId: undefined,
        roleId: undefined,
        mode: 'candidate',
        context: {}
      });

      expect(result.success).toBe(false);
      expect(result.error?.type).toBe('INVALID_INPUT');
    });

    it('should validate development plan structure', async () => {
      const mockRequest = {
        profileId: 'test-profile',
        roleId: 'test-role',
        mode: 'candidate',
        context: {},
        supabase: {} // Mock supabase client
      };

      const result = await getDevelopmentPlan.actionFn(mockRequest);
      
      if (result.success && result.data) {
        expect(result.data).toMatchObject({
          recommendedSkills: expect.any(Array),
          interimRoles: expect.any(Array),
          suggestedMentors: expect.any(Array),
          timeline: {
            shortTerm: expect.any(Array),
            mediumTerm: expect.any(Array),
            longTerm: expect.any(Array)
          },
          estimatedTimeToReadiness: expect.any(String),
          explanation: expect.any(String)
        });
      }
    });
  });
}); 