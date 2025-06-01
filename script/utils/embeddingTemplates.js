import { getEmbeddings } from './embeddings.js';

/**
 * Generates a markdown document for a role's embedding
 * @param {Object} role - The role object
 * @param {Object} options - Additional data like job details, capabilities, skills
 * @returns {string} Markdown formatted text
 */
export function generateRoleMarkdown(role, options = {}) {
  const {
    job,
    capabilities = [],
    skills = [],
    taxonomies = [],
    relatedJobs = [] // Array of job listings related to this role
  } = options;

  const sections = [];

  // Title is required
  sections.push(`# ${role.title}`);
  
  // Basic info - only add if exists
  const basicInfo = [];
  if (role.grade_band) basicInfo.push(`Grade Band: ${role.grade_band}`);
  if (role.location) basicInfo.push(`Location: ${role.location}`);
  if (basicInfo.length > 0) sections.push(basicInfo.join('\n'));

  // Primary purpose
  if (role.primary_purpose) {
    sections.push(`## Overview\n${role.primary_purpose}`);
  }

  // Combine role description and job descriptions
  const descriptions = [];
  if (role.raw_data?.description) {
    descriptions.push(role.raw_data.description);
  }
  
  // Add descriptions from related jobs
  const jobDescriptions = relatedJobs
    .filter(j => j?.raw_data?.description)
    .map(j => j.raw_data.description);
  
  if (jobDescriptions.length > 0) {
    descriptions.push(...jobDescriptions);
  }
  
  if (descriptions.length > 0) {
    sections.push(`## Role Description\n${descriptions.join('\n\n')}`);
  }

  // Capabilities section - only if we have valid capabilities
  const validCapabilities = capabilities.filter(cap => cap?.name);
  if (validCapabilities.length > 0) {
    sections.push('## Core Capabilities');
    const capabilitiesList = validCapabilities.map(cap => {
      const parts = [];
      parts.push(`- ${cap.name}`);
      if (cap.level) parts[0] += ` (${cap.level})`;
      if (cap.description) parts.push(`  ${cap.description}`);
      return parts.join('\n');
    });
    sections.push(capabilitiesList.join('\n'));
  }

  // Skills section - only if we have valid skills
  const validSkills = skills.filter(skill => skill?.name);
  if (validSkills.length > 0) {
    sections.push('## Required Skills');
    const skillsList = validSkills.map(skill => {
      const parts = [];
      parts.push(`- ${skill.name}`);
      if (skill.description) parts.push(`  ${skill.description}`);
      return parts.join('\n');
    });
    sections.push(skillsList.join('\n'));
  }

  // Taxonomies - only if we have valid taxonomies
  const validTaxonomies = taxonomies.filter(tax => tax?.name);
  if (validTaxonomies.length > 0) {
    sections.push('## Classifications');
    sections.push(validTaxonomies.map(tax => `- ${tax.name}`).join('\n'));
  }

  // Additional context - only add fields that exist
  const additionalInfo = [];
  if (role.raw_data?.division) {
    additionalInfo.push(`Division: ${role.raw_data.division}`);
  }
  if (role.raw_data?.reporting_line) {
    additionalInfo.push(`Reporting Line: ${role.raw_data.reporting_line}`);
  }
  if (additionalInfo.length > 0) {
    sections.push('## Additional Information\n' + additionalInfo.join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * Generates a markdown document for a skill's embedding
 * @param {Object} skill - The skill object
 * @param {Object} options - Additional data like related roles, categories
 * @returns {string} Markdown formatted text
 */
export function generateSkillMarkdown(skill, options = {}) {
  const {
    relatedRoles = [],
    categories = []
  } = options;

  const sections = [];

  // Title is required
  sections.push(`# ${skill.name}`);
  
  // Description if available
  if (skill.description) {
    sections.push(skill.description);
  }

  // Categories - only add if we have valid data
  const hasCategory = skill.category;
  const validCategories = categories.filter(Boolean);
  if (hasCategory || validCategories.length > 0) {
    sections.push('## Classification');
    if (hasCategory) {
      sections.push(`Primary Category: ${skill.category}`);
    }
    if (validCategories.length > 0) {
      sections.push('Related Categories:');
      sections.push(validCategories.map(cat => `- ${cat}`).join('\n'));
    }
  }

  // Related Roles - only if we have valid roles
  const validRoles = relatedRoles.filter(role => role?.title);
  if (validRoles.length > 0) {
    sections.push('## Common Role Contexts');
    const rolesList = validRoles.map(role => {
      const parts = [];
      parts.push(`- ${role.title}`);
      if (role.context) parts.push(`  ${role.context}`);
      return parts.join('\n');
    });
    sections.push(rolesList.join('\n'));
  }

  // Metadata - only add fields that exist
  const metadata = [];
  if (skill.source) metadata.push(`Source: ${skill.source}`);
  if (skill.is_occupation_specific) metadata.push('Occupation Specific: Yes');
  if (metadata.length > 0) {
    sections.push('## Metadata\n' + metadata.join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * Generates embeddings for a role using its markdown representation
 * @param {Object} role - The role object
 * @param {Object} options - Additional data for markdown generation
 * @returns {Promise<number[]>} The embedding vector
 */
export async function generateRoleEmbedding(role, options = {}) {
  try {
    const markdown = generateRoleMarkdown(role, options);
    return await getEmbeddings(markdown);
  } catch (error) {
    console.error(`Failed to generate embedding for role ${role.title}:`, error);
    throw error;
  }
}

/**
 * Generates embeddings for a skill using its markdown representation
 * @param {Object} skill - The skill object
 * @param {Object} options - Additional data for markdown generation
 * @returns {Promise<number[]>} The embedding vector
 */
export async function generateSkillEmbedding(skill, options = {}) {
  try {
    const markdown = generateSkillMarkdown(skill, options);
    return await getEmbeddings(markdown);
  } catch (error) {
    console.error(`Failed to generate embedding for skill ${skill.name}:`, error);
    throw error;
  }
} 