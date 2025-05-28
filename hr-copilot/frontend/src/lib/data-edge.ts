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

  if (data && typeof data === 'object' && 'error' in data) {
    console.error('Data Edge Response Error:', data.error);
    throw new Error(typeof data.error === 'string' ? data.error : data.error.message || 'Failed to fetch data');
  }

  return data;
} 