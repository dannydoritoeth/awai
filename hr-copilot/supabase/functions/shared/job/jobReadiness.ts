import { ProfileData } from '../profile/getProfileData.ts';
import { RoleData } from '../role/getRoleData.ts';

interface ReadinessResult {
  score: number;
  skillGaps: Array<{
    name: string;
    required: number;
    actual: number;
  }>;
  capabilityGaps: Array<{
    name: string;
    required: number;
    actual: number;
  }>;
}

export function calculateJobReadiness(
  profileData: ProfileData,
  roleData: RoleData
): number {
  const skillMatches = roleData.skills.map(required => {
    const actual = profileData.skills.find(s => s.id === required.id);
    return {
      name: required.name,
      required: required.required_level,
      actual: actual?.level || 0,
      match: actual ? Math.min(actual.level / required.required_level, 1) : 0
    };
  });

  const capabilityMatches = roleData.capabilities.map(required => {
    const actual = profileData.capabilities.find(c => c.id === required.id);
    return {
      name: required.name,
      required: required.required_level,
      actual: actual?.level || 0,
      match: actual ? Math.min(actual.level / required.required_level, 1) : 0
    };
  });

  // Calculate average match scores
  const skillScore = skillMatches.reduce((sum, m) => sum + m.match, 0) / (skillMatches.length || 1);
  const capabilityScore = capabilityMatches.reduce((sum, m) => sum + m.match, 0) / (capabilityMatches.length || 1);

  // Weight skills slightly higher than capabilities
  return (skillScore * 0.6 + capabilityScore * 0.4) * 100;
}

export function generateJobSummary(
  profileData: ProfileData,
  roleData: RoleData
): string {
  const skillGaps = roleData.skills
    .map(required => {
      const actual = profileData.skills.find(s => s.id === required.id);
      return {
        name: required.name,
        required: required.required_level,
        actual: actual?.level || 0
      };
    })
    .filter(gap => gap.actual < gap.required);

  const capabilityGaps = roleData.capabilities
    .map(required => {
      const actual = profileData.capabilities.find(c => c.id === required.id);
      return {
        name: required.name,
        required: required.required_level,
        actual: actual?.level || 0
      };
    })
    .filter(gap => gap.actual < gap.required);

  const matchingSkills = roleData.skills
    .filter(required => {
      const actual = profileData.skills.find(s => s.id === required.id);
      return actual && actual.level >= required.required_level;
    })
    .map(s => s.name);

  // Generate summary
  const parts = [];
  
  if (matchingSkills.length > 0) {
    parts.push(`Strong match in: ${matchingSkills.slice(0, 3).join(', ')}`);
  }
  
  if (skillGaps.length > 0) {
    parts.push(`Skill gaps: ${skillGaps.length}`);
  }
  
  if (capabilityGaps.length > 0) {
    parts.push(`Capability gaps: ${capabilityGaps.length}`);
  }

  return parts.join('. ');
} 