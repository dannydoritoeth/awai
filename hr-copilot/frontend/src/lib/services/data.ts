import { supabase } from '../supabaseClient';
import { dataEdge } from '../data-edge';

export interface GeneralRole {
  id: string;
  title: string;
  description: string | null;
  function_area: string;
  classification_level: string;
  created_at: string;
  updated_at: string;
  similar_roles?: string[];
  role_category?: string;
  semantic_keywords?: string[];
}

export interface FilterOption {
  id: string;
  label: string;
}

export interface RoleFilters {
  taxonomies?: string[]; // UUIDs
  regions?: string[]; // UUIDs
  divisions?: string[]; // UUIDs
  employmentTypes?: string[]; // UUIDs
  capabilities?: string[]; // UUIDs
  skills?: string[]; // UUIDs
  companies?: string[]; // UUIDs
}

export interface GeneralRolesParams {
  functionArea?: string;
  classificationLevel?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
  filters?: RoleFilters;
}

export interface DataResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface Division {
  id: string;
  name: string;
  cluster: string;
  agency: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string | null;
  source?: string;
  is_occupation_specific?: boolean;
}

export interface Capability {
  id: string;
  name: string;
  group_name: string;
  description: string | null;
  type: string;
  level: string;
}

export interface Document {
  document_id: string;
  document_url: string;
  document_type: string;
  title: string;
}

export interface Role {
  id: string;
  title: string;
  division: {
    id: string;
    name: string;
    cluster?: string;
    agency?: string;
  };
  grade_band?: string;
  location?: string;
  primary_purpose?: string;
  reporting_line?: string;
  direct_reports?: string;
  budget_responsibility?: string;
  anzsco_code?: string;
  pcat_code?: string;
  date_approved?: string;
  source_document_url?: string;
  skills?: Skill[];
  capabilities?: Capability[];
  documents?: Document[];
}

interface SpecificRoleResponse {
  role: Role;
  skills?: Skill[];
  capabilities?: Capability[];
  documents?: Document[];
}

export interface TransitionType {
  id: string;
  name: string;
  description: string;
}

export interface Requirement {
  id: string;
  name: string;
  description: string;
  requirement_type: string;
  required_level: string;
  is_mandatory: boolean;
}

export interface Transition {
  id: string;
  from_role: Role;
  to_role: Role;
  transition_type: TransitionType;
  frequency: number;
  success_rate: number;
  avg_time_months: number;
  requirements?: Requirement[];
}

export interface TransitionHistory {
  id: string;
  from_role: Role;
  to_role: Role;
  transition_type: TransitionType;
  start_date: string;
  end_date?: string;
  status: string;
  success_rating?: number;
  feedback?: string;
}

export interface TransitionFilters {
  transitionTypes?: string[];
  status?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface GetRoleTransitionsParams {
  roleId: string;
  direction?: 'from' | 'to' | 'both';
  includeRequirements?: boolean;
  includeHistory?: boolean;
  limit?: number;
  offset?: number;
  filters?: TransitionFilters;
}

export interface GetPossibleTransitionsParams {
  roleId: string;
  profileId?: string;
  maxSuggestions?: number;
  considerFactors?: {
    skills?: boolean;
    experience?: boolean;
    qualifications?: boolean;
    interests?: boolean;
    careerGoals?: boolean;
  };
}

export interface TransitionSuggestion {
  role: Role;
  transitionType: string;
  matchScore: number;
  reasons: string[];
  developmentAreas: string[];
  estimatedPreparationTime: string;
  suggestedLearningPath: string[];
  riskAssessment: {
    successFactors: string[];
    challenges: string[];
    mitigationStrategies: string[];
    historicalSuccessRate: number;
  };
}

export interface Company {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyFilters {
  searchTerm?: string;
  divisions?: string[];
}

export interface TaxonomyFilters {
  searchTerm?: string;
  taxonomyType?: string;
  [key: string]: unknown;
}

export interface Taxonomy {
  id: string;
  name: string;
  description: string | null;
  taxonomy_type: string;
  created_at: string;
  updated_at: string;
  role_count: number;
  divisions: string[];
}

export interface SkillFilters {
  searchTerm?: string;
  categories?: string[];
  isOccupationSpecific?: boolean;
}

export async function getGeneralRoles(params: GeneralRolesParams = {}): Promise<DataResponse<GeneralRole[]>> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        insightId: 'getGeneralRoles',
        ...params
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
}

export async function getRole(roleId: string, options: {
  includeSkills?: boolean;
  includeCapabilities?: boolean;
  includeDocuments?: boolean;
} = {}): Promise<DataResponse<SpecificRoleResponse>> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        insightId: 'getRole',
        roleId,
        ...options
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
}

// Function to get function areas from general_role_types
export async function getFunctionAreas(): Promise<string[]> {
  const { data, error } = await supabase
    .from('general_role_types')
    .select('type')
    .eq('category', 'function_area')
    .order('type');

  if (error) throw error;
  return data.map(row => row.type);
}

// Function to get classification levels from general_role_types
export async function getClassificationLevels(): Promise<string[]> {
  const { data, error } = await supabase
    .from('general_role_types')
    .select('type')
    .eq('category', 'classification_level')
    .order('type');

  if (error) throw error;
  return data.map(row => row.type);
}

// Add helper functions to get filter options
// Replaced with new implementation with filters

export async function getRegions(): Promise<FilterOption[]> {
  const data = await dataEdge({
    insightId: 'getRegions'
  });
  return data;
}

export async function getDivisions(): Promise<FilterOption[]> {
  const data = await dataEdge({
    insightId: 'getDivisions'
  });
  return data;
}

export async function getEmploymentTypes(): Promise<FilterOption[]> {
  const data = await dataEdge({
    insightId: 'getEmploymentTypes'
  });
  return data;
}

export async function getCompanies(filters?: CompanyFilters): Promise<DataResponse<Company[]>> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'getCompanies',
        filters
      }),
    });

    const data = await response.json();
    return {
      success: true,
      data: data.companies,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch companies'
    };
  }
}

export async function getCompany(companyId: string): Promise<DataResponse<Company>> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'getCompany',
        companyId
      }),
    });

    const data = await response.json();
    return {
      success: true,
      data: data.company,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch company'
    };
  }
}

export async function getTaxonomies(filters?: TaxonomyFilters): Promise<DataResponse<Taxonomy[]>> {
  try {
    const data = await dataEdge({
      insightId: 'getTaxonomies',
      params: filters
    });
    return {
      success: true,
      data,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch taxonomies'
    };
  }
}

export async function getTaxonomy(taxonomyId: string): Promise<DataResponse<Taxonomy>> {
  try {
    const data = await dataEdge({
      insightId: 'getTaxonomy',
      params: { id: taxonomyId }
    });
    return {
      success: true,
      data,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch taxonomy'
    };
  }
}

export async function getSkills(filters?: SkillFilters): Promise<DataResponse<Skill[]>> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'getSkills',
        filters
      }),
    });

    const data = await response.json();
    return {
      success: true,
      data: data.skills,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch skills'
    };
  }
}

export async function getSkill(skillId: string): Promise<DataResponse<Skill>> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'getSkill',
        skillId
      }),
    });

    const data = await response.json();
    return {
      success: true,
      data: data.skill,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch skill'
    };
  }
}

export async function getRoleTransitions(params: GetRoleTransitionsParams): Promise<DataResponse<{
  transitions: Transition[];
  history?: TransitionHistory[];
}>> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        insightId: 'getRoleTransitions',
        ...params
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
}

export async function getPossibleTransitions(params: GetPossibleTransitionsParams): Promise<DataResponse<{
  structured: TransitionSuggestion[];
  raw: string;
}>> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        insightId: 'getPossibleTransitions',
        ...params
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
}

export async function getSpecificRole(roleId: string): Promise<DataResponse<Role>> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        insightId: 'getSpecificRole',
        roleId
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
} 