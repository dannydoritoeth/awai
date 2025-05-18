import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';

export interface RoleData {
  id: string;
  title: string;
  department?: string;  // This will be derived from division data
  location?: string;
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
  console.log('Getting role data for IDs:', roleIds);

  const [rolesResult, skillsResult, capabilitiesResult] = await Promise.all([
    // Get basic role information including division data
    supabase
      .from('roles')
      .select(`
        id,
        title,
        location,
        divisions (
          name
        )
      `)
      .in('id', roleIds),
    
    // Get role skills - using the correct join table structure
    supabase
      .from('role_skills')
      .select(`
        role_id,
        skill:skills (
          id,
          name
        )
      `)
      .in('role_id', roleIds),
    
    // Get role capabilities - using the correct join table structure
    supabase
      .from('role_capabilities')
      .select(`
        role_id,
        capability:capabilities (
          id,
          name
        ),
        level,
        capability_type
      `)
      .in('role_id', roleIds)
  ]);

  // Log results and any errors
  console.log('Roles query result:', {
    data: rolesResult.data?.length || 0,
    error: rolesResult.error
  });
  console.log('Skills query result:', {
    data: skillsResult.data?.length || 0,
    error: skillsResult.error
  });
  console.log('Capabilities query result:', {
    data: capabilitiesResult.data?.length || 0,
    error: capabilitiesResult.error
  });

  // Group by role_id
  const roleData: Record<string, RoleData> = {};
  
  // Initialize role data objects with basic information
  (rolesResult.data || []).forEach(role => {
    roleData[role.id] = {
      id: role.id,
      title: role.title,
      department: role.divisions?.name, // Use division name as department
      location: role.location,
      skills: [],
      capabilities: []
    };
  });

  // Group skills by role
  (skillsResult.data || []).forEach(s => {
    if (roleData[s.role_id] && s.skill) {
      roleData[s.role_id].skills.push({
        id: s.skill.id,
        name: s.skill.name,
        required_level: 0, // Default since schema doesn't have this
        required_years: 0  // Default since schema doesn't have this
      });
    }
  });

  // Group capabilities by role
  (capabilitiesResult.data || []).forEach(c => {
    if (roleData[c.role_id] && c.capability) {
      roleData[c.role_id].capabilities.push({
        id: c.capability.id,
        name: c.capability.name,
        required_level: c.level ? parseInt(c.level, 10) : 0
      });
    }
  });

  console.log('Final role data:', {
    roleCount: Object.keys(roleData).length,
    firstRole: Object.values(roleData)[0]
  });

  return roleData;
}

function cleanAIPrompt(prompt: string, profileData: any, matches: any[]): string {
  // Extract just the essential profile data
  const cleanProfile = {
    skills: profileData.skills.map(s => ({
      id: s.id,
      name: s.name,
      level: s.level || 0
    })),
    capabilities: profileData.capabilities.map(c => ({
      id: c.id,
      name: c.name,
      level: c.level || 0
    }))
  };

  // Extract just the essential match data
  const cleanMatches = matches.map(m => ({
    id: m.id,
    name: m.name,
    type: m.type,
    similarity: m.similarity,
    summary: m.summary || ''
  }));

  // Construct clean prompt
  return `${prompt} <context>{"profile":${JSON.stringify(cleanProfile)},"matches":${JSON.stringify(cleanMatches)}}</context>`;
} 