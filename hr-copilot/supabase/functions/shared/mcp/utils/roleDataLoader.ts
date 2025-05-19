import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../../database.types.ts';
import { getRolesData, RoleData } from '../../role/getRoleData.ts';

/**
 * Load complete role data for use in prompts
 */
export async function loadRoleDataForPrompt(
  supabase: SupabaseClient<Database>,
  roleId: string
): Promise<RoleData> {
  // Load complete role data including skills and capabilities
  const rolesData = await getRolesData(supabase, [roleId]);
  
  if (!rolesData[roleId]) {
    throw new Error(`Role data not found for ID: ${roleId}`);
  }

  return rolesData[roleId];
}

/**
 * Load complete role data for multiple roles
 */
export async function loadMultipleRoleDataForPrompt(
  supabase: SupabaseClient<Database>,
  roleIds: string[]
): Promise<Record<string, RoleData>> {
  // Load complete role data including skills and capabilities
  return await getRolesData(supabase, roleIds);
} 