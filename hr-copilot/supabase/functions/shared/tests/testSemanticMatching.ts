import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../../database.types.ts';
import { getSemanticMatches } from '../embeddings.ts';
import { SemanticMatch } from '../mcpTypes.ts';

export async function testSemanticMatching(
  supabase: SupabaseClient<Database>,
  sourceId: string,
  sourceTable: 'profiles' | 'roles',
  targetTable: 'profiles' | 'roles' | 'skills' | 'capabilities' | 'companies'
): Promise<{
  success: boolean;
  matches?: SemanticMatch[];
  error?: string;
  debug?: any;
}> {
  console.log('Starting semantic matching test:', {
    sourceId,
    sourceTable,
    targetTable
  });

  try {
    // First verify source exists
    const { data: source, error: sourceError } = await supabase
      .from(sourceTable)
      .select('id, name, embedding')
      .eq('id', sourceId)
      .single();

    if (sourceError || !source) {
      console.error('Source entity not found:', sourceError);
      return {
        success: false,
        error: `Source ${sourceTable} with ID ${sourceId} not found`,
        debug: { sourceError }
      };
    }

    if (!source.embedding) {
      console.warn('Source has no embedding:', {
        table: sourceTable,
        id: sourceId
      });
    }

    // Attempt to get semantic matches
    console.log('Fetching semantic matches...');
    const matches = await getSemanticMatches(
      supabase,
      { id: sourceId, table: sourceTable },
      targetTable,
      5, // Small limit for testing
      0.3 // Lower threshold for testing
    );

    console.log('Semantic matching results:', {
      matchCount: matches.length,
      matches: matches.map(m => ({
        id: m.id,
        type: m.type,
        similarity: m.similarity,
        name: m.name
      }))
    });

    return {
      success: true,
      matches,
      debug: {
        sourceFound: true,
        hasEmbedding: !!source.embedding,
        matchCount: matches.length
      }
    };

  } catch (error) {
    console.error('Test failed:', error);
    return {
      success: false,
      error: error.message,
      debug: { error }
    };
  }
} 