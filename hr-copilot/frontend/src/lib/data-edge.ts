import { supabase } from './supabase';

interface DataEdgeParams {
  insightId: string;
  params?: {
    id?: string;
    searchTerm?: string;
    divisions?: string[];
    cluster?: string;
    agency?: string;
    [key: string]: unknown;
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
  return data.data; // Extract the data from the wrapper object
} 