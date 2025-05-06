import { SupabaseClient } from '@supabase/supabase-js'

export interface DatabaseError {
  type: 'NOT_FOUND' | 'INVALID_INPUT' | 'DATABASE_ERROR';
  message: string;
  details?: any;
}

export interface DatabaseResponse<T> {
  data: T | null;
  error: DatabaseError | null;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  role_title: string;
  division: string;
  last_active: string;
}

export interface Role {
  id: string;
  title: string;
  division_id: string;
  grade_band: string;
}

export interface SuggestedPath {
  fromRoleId: string;
  fromRoleTitle: string;
  toRoleId: string;
  toRoleTitle: string;
  matchScore?: number;
  reason?: string;
}

export type GapType = 'missing' | 'insufficient' | 'met';

export interface CapabilityGap {
  capabilityId: string;
  name: string;
  groupName: string;
  requiredLevel?: string;
  profileLevel?: string;
  gapType: GapType;
  severity?: number; // 0-100, higher means bigger gap
}

export interface SkillGap {
  skillId: string;
  name: string;
  category: string;
  requiredLevel?: string;
  profileLevel?: string;
  gapType: GapType;
  severity?: number; // 0-100, higher means bigger gap
}

export interface JobFitScore {
  score: number; // 0-100 readiness score
  summary: string;
  matchedCapabilities: string[];
  missingCapabilities: string[];
  matchedSkills: string[];
  missingSkills: string[];
  capabilityScore: number; // 0-100 subscore for capabilities
  skillScore: number; // 0-100 subscore for skills
}

export interface RoleCapability {
  capabilityId: string;
  name: string;
  level?: string;
  isCritical?: boolean;
}

export interface RoleDetail {
  roleId: string;
  title: string;
  description?: string;
  gradeBand?: string;
  divisionId?: string;
  capabilities: RoleCapability[];
  accountabilities: string[]; // Using empty array as default instead of undefined
} 