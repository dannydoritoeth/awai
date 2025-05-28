import { supabase } from './supabase';

interface DataEdgeParams {
  insightId: string;
  params?: Record<string, any>;
}

export async function dataEdge({ insightId, params = {} }: DataEdgeParams) {
  const { data, error } = await supabase.functions.invoke('data', {
    body: {
      insightId,
      params
    }
  });

  if (error) throw error;
  return data;
} 