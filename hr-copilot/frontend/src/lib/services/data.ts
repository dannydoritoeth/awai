import { supabase } from '../supabaseClient';

interface GeneralRole {
  id: string;
  title: string;
  description: string | null;
  function_area: string;
  classification_level: string;
  created_at: string;
  updated_at: string;
}

interface GeneralRolesParams {
  functionArea?: string;
  classificationLevel?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

interface DataResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
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