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
  // Calculate skill matches with fuzzy matching
  const skillMatches = roleData.skills.map(required => {
    // Try exact match first
    let actual = profileData.skills.find(s => s.id === required.id);
    
    // If no exact match, try fuzzy match by name
    if (!actual) {
      actual = profileData.skills.find(s => 
        s.name.toLowerCase() === required.name.toLowerCase() ||
        s.name.toLowerCase().includes(required.name.toLowerCase()) ||
        required.name.toLowerCase().includes(s.name.toLowerCase())
      );
    }

    return {
      name: required.name,
      required: required.required_level,
      actual: actual?.level || 0,
      match: actual ? Math.min(actual.level / required.required_level, 1) : 0
    };
  });

  // Calculate capability matches with fuzzy matching
  const capabilityMatches = roleData.capabilities.map(required => {
    // Try exact match first
    let actual = profileData.capabilities.find(c => c.id === required.id);
    
    // If no exact match, try fuzzy match by name
    if (!actual) {
      actual = profileData.capabilities.find(c => 
        c.name.toLowerCase() === required.name.toLowerCase() ||
        c.name.toLowerCase().includes(required.name.toLowerCase()) ||
        required.name.toLowerCase().includes(c.name.toLowerCase())
      );
    }

    return {
      name: required.name,
      required: required.required_level,
      actual: actual?.level || 0,
      match: actual ? Math.min(actual.level / required.required_level, 1) : 0
    };
  });

  // Calculate weighted scores
  const skillScore = skillMatches.length > 0 
    ? skillMatches.reduce((sum, m) => sum + m.match, 0) / skillMatches.length 
    : 0;
  
  const capabilityScore = capabilityMatches.length > 0
    ? capabilityMatches.reduce((sum, m) => sum + m.match, 0) / capabilityMatches.length
    : 0;

  // Weight skills slightly higher than capabilities (60/40 split)
  return (skillScore * 0.6 + capabilityScore * 0.4) * 100;
}

export function generateJobSummary(
  profileData: ProfileData,
  roleData: RoleData
): string {
  // Find matching and missing skills
  const skillAnalysis = roleData.skills.map(required => {
    const actual = profileData.skills.find(s => 
      s.id === required.id || 
      s.name.toLowerCase() === required.name.toLowerCase() ||
      s.name.toLowerCase().includes(required.name.toLowerCase()) ||
      required.name.toLowerCase().includes(s.name.toLowerCase())
    );
    return {
      name: required.name,
      status: actual 
        ? actual.level >= required.required_level 
          ? 'met' 
          : 'insufficient'
        : 'missing'
    };
  });

  const capabilityAnalysis = roleData.capabilities.map(required => {
    const actual = profileData.capabilities.find(c => 
      c.id === required.id ||
      c.name.toLowerCase() === required.name.toLowerCase() ||
      c.name.toLowerCase().includes(required.name.toLowerCase()) ||
      required.name.toLowerCase().includes(c.name.toLowerCase())
    );
    return {
      name: required.name,
      status: actual 
        ? actual.level >= required.required_level 
          ? 'met' 
          : 'insufficient'
        : 'missing'
    };
  });

  const matchingSkills = skillAnalysis.filter(s => s.status === 'met');
  const missingSkills = skillAnalysis.filter(s => s.status === 'missing');
  const insufficientSkills = skillAnalysis.filter(s => s.status === 'insufficient');

  const matchingCapabilities = capabilityAnalysis.filter(c => c.status === 'met');
  const missingCapabilities = capabilityAnalysis.filter(c => c.status === 'missing');
  const insufficientCapabilities = capabilityAnalysis.filter(c => c.status === 'insufficient');

  // Generate detailed summary
  const parts = [];

  if (matchingSkills.length > 0) {
    parts.push(`Strong match in skills: ${matchingSkills.map(s => s.name).join(', ')}`);
  }

  if (matchingCapabilities.length > 0) {
    parts.push(`Matching capabilities: ${matchingCapabilities.map(c => c.name).join(', ')}`);
  }

  if (insufficientSkills.length > 0 || missingSkills.length > 0) {
    const skillGaps = [
      ...insufficientSkills.map(s => `${s.name} (needs improvement)`),
      ...missingSkills.map(s => `${s.name} (missing)`)
    ];
    parts.push(`Skill gaps: ${skillGaps.join(', ')}`);
  }

  if (insufficientCapabilities.length > 0 || missingCapabilities.length > 0) {
    const capabilityGaps = [
      ...insufficientCapabilities.map(c => `${c.name} (needs improvement)`),
      ...missingCapabilities.map(c => `${c.name} (missing)`)
    ];
    parts.push(`Capability gaps: ${capabilityGaps.join(', ')}`);
  }

  return parts.join('. ');
} 