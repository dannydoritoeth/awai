import { supabase } from './supabase';

interface DataEdgeParams {
  insightId: string;
  params?: {
    id?: string;
    searchTerm?: string;
    divisions?: string[];
    cluster?: string;
    agency?: string;
    type?: 'general' | 'specific';
    [key: string]: unknown;
  };
}

interface RoleSkill {
  skill_id: string;
  skills: {
    id: string;
    name: string;
    category: string;
  };
}

export async function dataEdge({ insightId, params = {} }: DataEdgeParams) {
  console.log('Data Edge Request:', {
    insightId,
    params
  });

  // Handle skills directly
  if (insightId === 'getSkills') {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .order('name');

    if (error) throw new Error(error.message);
    return data;
  }

  if (insightId === 'getSkill' && params.id) {
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // Handle roles directly
  if (insightId === 'getRoles') {
    if (params.type === 'general') {
      const { data, error } = await supabase
        .from('general_roles')
        .select('id, title, description, function_area, classification_level, created_at, updated_at')
        .order('title');

      if (error) throw new Error(error.message);
      return data.map(role => ({
        ...role,
        is_specific: false
      }));
    } else {
      const { data, error } = await supabase
        .from('roles')
        .select('id, title, division_id, grade_band, created_at, updated_at')
        .order('title');

      if (error) throw new Error(error.message);
      return data.map(role => ({
        ...role,
        is_specific: true
      }));
    }
  }

  if (insightId === 'getRole' && params.id) {
    // Try general roles first
    const { data: generalRole, error: generalError } = await supabase
      .from('general_roles')
      .select('*')
      .eq('id', params.id)
      .single();

    if (!generalError && generalRole) {
      return {
        ...generalRole,
        is_specific: false,
        skills: [] // TODO: Add general role skills when implemented
      };
    }

    // If not found in general roles, try specific roles
    const { data: specificRole, error: specificError } = await supabase
      .from('roles')
      .select(`
        *,
        role_skills (
          skill_id,
          skills (
            id,
            name,
            category
          )
        )
      `)
      .eq('id', params.id)
      .single();

    if (specificError) throw new Error(specificError.message);
    
    if (specificRole) {
      return {
        ...specificRole,
        is_specific: true,
        skills: (specificRole.role_skills as RoleSkill[])?.map(rs => ({
          ...rs.skills,
          required_level: 1 // Default level since our schema doesn't have this field yet
        })) || [],
        role_skills: undefined
      };
    }

    throw new Error('Role not found');
  }

  // For other insights, use the Edge Function
  const { data, error } = await supabase.functions.invoke('data', {
    body: {
      insightId,
      params,
      browserSessionId: typeof window !== 'undefined' ? window.sessionStorage.getItem('browserSessionId') : null
    }
  });

  if (error) {
    console.error('Data Edge Error:', error);
    throw new Error(error.message || 'Failed to fetch data');
  }

  if (!data) {
    console.error('Data Edge Response: No data received');
    throw new Error('No data received from Edge Function');
  }

  if ('error' in data) {
    console.error('Data Edge Response Error:', data.error);
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to fetch data');
  }

  console.log('Data Edge Response:', data);
  return data.data;
} 