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

export async function getProfileData(
  supabase: SupabaseClient<Database>,
  profileId: string
): Promise<ProfileData> {
  const [skillsResult, capabilitiesResult] = await Promise.all([
    supabase
      .from('profile_skills')
      .select(`
        id,
        skill:skills(id, name),
        level,
        years
      `)
      .eq('profile_id', profileId),
    
    supabase
      .from('profile_capabilities')
      .select(`
        id,
        capability:capabilities(id, name),
        level
      `)
      .eq('profile_id', profileId)
  ]);

  return {
    skills: (skillsResult.data || []).map(s => ({
      id: s.skill.id,
      name: s.skill.name,
      level: s.level,
      years: s.years
    })),
    capabilities: (capabilitiesResult.data || []).map(c => ({
      id: c.capability.id,
      name: c.capability.name,
      level: c.level
    }))
  };
} 