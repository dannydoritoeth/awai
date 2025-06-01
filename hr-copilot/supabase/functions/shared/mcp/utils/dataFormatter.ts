/**
 * Format data as a JSON string with delimiters
 */
export function formatJsonData(data: any, useDelimiters = true): string {
  const jsonStr = JSON.stringify(data, null, 2);
  return useDelimiters ? `<json>\n${jsonStr}\n</json>` : jsonStr;
}

/**
 * Format role data for prompts
 */
export function formatRoleData(role: any): string {
  const roleData = {
    role: {
      data: {
        roleId: role.id,
        title: role.title,
        department: role.department,
        divisionId: role.divisionId,
        gradeBand: role.gradeBand,
        location: role.location,
        primaryPurpose: role.primaryPurpose,
        reportingLine: role.reportingLine,
        directReports: role.directReports,
        budgetResponsibility: role.budgetResponsibility,
        skills: (role.skills || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          required_level: s.required_level || 0,
          required_years: s.required_years || 0
        })),
        capabilities: (role.capabilities || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          required_level: c.required_level || 0
        }))
      },
      error: null
    }
  };

  return formatJsonData(roleData);
}

/**
 * Format candidates data for prompts
 */
export function formatCandidatesData(candidates: any[]): string {
  const candidatesData = {
    candidates: candidates.map(candidate => ({
      profileId: candidate.profileId,
      name: candidate.name,
      score: candidate.score,
      semanticScore: candidate.semanticScore,
      details: {
        capabilities: {
          matched: candidate.matchedCapabilities || [],
          missing: candidate.missingCapabilities || [],
          insufficient: candidate.insufficientCapabilities || []
        },
        skills: {
          matched: candidate.matchedSkills || [],
          missing: candidate.missingSkills || [],
          insufficient: candidate.insufficientSkills || []
        }
      }
    }))
  };

  return formatJsonData(candidatesData);
}

/**
 * Format sections data for prompts
 */
export function formatSectionsData(): string {
  const sectionsData = {
    sections: [
      "ROLE REQUIREMENTS OVERVIEW",
      "CANDIDATE POOL QUALITY",
      "INDIVIDUAL CANDIDATE ASSESSMENTS",
      "INTERVIEW RECOMMENDATIONS",
      "HIRING RECOMMENDATIONS"
    ]
  };

  return formatJsonData(sectionsData);
} 