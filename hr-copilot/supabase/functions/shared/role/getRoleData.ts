import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';

export interface RoleData {
  id: string;
  skills: {
    id: string;
    name: string;
    required_level: number;
    required_years: number;
  }[];
  capabilities: {
    id: string;
    name: string;
    required_level: number;
  }[];
}

export async function getRolesData(
  supabase: SupabaseClient<Database>,
  roleIds: string[]
): Promise<Record<string, RoleData>> {
  const [skillsResult, capabilitiesResult] = await Promise.all([
    supabase
      .from('role_skills')
      .select(`
        id,
        role_id,
        skill:skills(id, name),
        required_level,
        required_years
      `)
      .in('role_id', roleIds),
    
    supabase
      .from('role_capabilities')
      .select(`
        id,
        role_id,
        capability:capabilities(id, name),
        required_level
      `)
      .in('role_id', roleIds)
  ]);

  // Group by role_id
  const roleData: Record<string, RoleData> = {};
  
  // Initialize role data objects
  roleIds.forEach(id => {
    roleData[id] = {
      id,
      skills: [],
      capabilities: []
    };
  });

  // Group skills by role
  (skillsResult.data || []).forEach(s => {
    if (roleData[s.role_id]) {
      roleData[s.role_id].skills.push({
        id: s.skill.id,
        name: s.skill.name,
        required_level: s.required_level,
        required_years: s.required_years
      });
    }
  });

  // Group capabilities by role
  (capabilitiesResult.data || []).forEach(c => {
    if (roleData[c.role_id]) {
      roleData[c.role_id].capabilities.push({
        id: c.capability.id,
        name: c.capability.name,
        required_level: c.required_level
      });
    }
  });

  return roleData;
} 