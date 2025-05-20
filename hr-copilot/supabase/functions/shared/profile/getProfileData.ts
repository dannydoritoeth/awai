import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';

export interface ProfileData {
  skills: {
    id: string;
    name: string;
    level: number;
    years: number;
  }[];
  capabilities: {
    id: string;
    name: string;
    level: number;
  }[];
}

function parseLevel(level: string | null): number {
  if (!level) return 0;
  // Try to parse as number first
  const num = Number(level);
  if (!isNaN(num)) return num;
  // Handle text levels
  switch(level.toLowerCase()) {
    case 'expert':
    case 'high':
      return 5;
    case 'advanced':
      return 4;
    case 'intermediate':
      return 3;
    case 'basic':
    case 'low':
      return 2;
    case 'novice':
    case 'none':
      return 1;
    default:
      return 0;
  }
}

export async function getProfileData(
  supabase: SupabaseClient<Database>,
  profileId: string
): Promise<ProfileData> {
  console.log('Getting profile data for:', profileId);

  if (!profileId) {
    console.error('Invalid profileId provided');
    return { skills: [], capabilities: [] };
  }

  try {
    const [skillsResult, capabilitiesResult] = await Promise.all([
      supabase
        .from('profile_skills')
        .select(`
          skill_id,
          rating,
          evidence,
          skills (
            id,
            name
          )
        `)
        .eq('profile_id', profileId),
      
      supabase
        .from('profile_capabilities')
        .select(`
          capability_id,
          level,
          capabilities (
            id,
            name
          )
        `)
        .eq('profile_id', profileId)
    ]);

    // Log any errors immediately
    if (skillsResult.error) {
      console.error('Skills query error:', skillsResult.error);
      throw skillsResult.error;
    }
    if (capabilitiesResult.error) {
      console.error('Capabilities query error:', capabilitiesResult.error);
      throw capabilitiesResult.error;
    }

    console.log('Raw skills data:', skillsResult.data);
    console.log('Raw capabilities data:', capabilitiesResult.data);

    const skills = (skillsResult.data || [])
      .filter(s => s?.skills && s?.skill_id) // Add null check for skills object
      .map(s => ({
        id: s.skill_id,
        name: s.skills?.name || 'Unknown Skill', // Add fallback for name
        level: parseLevel(s.rating),
        years: 0 // Default since we don't track years
      }));

    const capabilities = (capabilitiesResult.data || [])
      .filter(c => c?.capabilities && c?.capability_id) // Add null check for capabilities object
      .map(c => ({
        id: c.capability_id,
        name: c.capabilities?.name || 'Unknown Capability', // Add fallback for name
        level: parseLevel(c.level)
      }));

    console.log('Processed profile data:', {
      skillsCount: skills.length,
      capabilitiesCount: capabilities.length,
      sampleSkill: skills[0],
      sampleCapability: capabilities[0]
    });

    return { skills, capabilities };
  } catch (error) {
    console.error('Error in getProfileData:', error);
    // Return empty arrays rather than throwing to prevent breaking the entire flow
    return {
      skills: [],
      capabilities: []
    };
  }
} 