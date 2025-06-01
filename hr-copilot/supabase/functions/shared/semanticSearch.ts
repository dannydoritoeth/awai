import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from '../database.types.ts';
import { SemanticMatch } from './mcpTypes.ts';
import { Tables } from './embeddings.ts';

export interface SemanticSearchParams {
  embedding: number[];
  tables: Tables[];
  companyId?: string;
  filters?: Record<string, string>;
  limit?: number;
  perTypeLimit?: number;
  minScore?: number;
}

/**
 * Perform semantic similarity search across multiple tables
 */
export async function getSemanticMatches(
  supabase: SupabaseClient<Database>,
  params: SemanticSearchParams
): Promise<SemanticMatch[]> {
  const {
    embedding,
    tables,
    companyId,
    filters = {},
    limit = 10,
    perTypeLimit = 5,
    minScore = 0.7
  } = params;

  const results: SemanticMatch[] = [];

  // Helper to build common query parts
  const buildQuery = async (table: Tables, nameField: string = 'title') => {
    // First get matches from vector similarity search
    const { data: matches, error: rpcError } = await supabase
      .rpc('match_embeddings_by_vector', {
        p_query_embedding: embedding,
        p_table_name: table,
        p_match_threshold: minScore,
        p_match_count: perTypeLimit
      });

    if (rpcError) {
      console.error(`RPC error for ${table}:`, rpcError);
      return [];
    }

    if (!matches || !matches.length) {
      return [];
    }

    // Then get full details for the matched IDs
    let query = supabase
      .from(table)
      .select(`
        id,
        ${nameField},
        metadata:raw_json,
        division:divisions (
          name,
          cluster,
          agency
        )
      `)
      .in('id', matches.map(m => m.id));

    // Apply company filter if provided
    if (companyId) {
      if (table === 'companies') {
        query = query.eq('id', companyId);
      } else if (table === 'divisions') {
        query = query.eq('company_id', companyId);
      } else if (table === 'roles' || table === 'jobs') {
        query = query.eq('division.company_id', companyId);
      }
    }

    // Apply additional filters
    Object.entries(filters || {}).forEach(([key, value]) => {
      if (value) {
        query = query.eq(key, value);
      }
    });

    const { data: details, error: queryError } = await query;

    if (queryError) {
      console.error(`Query error for ${table}:`, queryError);
      return [];
    }

    // Combine similarity scores with details
    return details?.map(item => {
      const match = matches.find(m => m.id === item.id);
      return {
        id: item.id,
        type: table.slice(0, -1) as SemanticMatch['type'],
        name: item[nameField] || 'Unnamed',
        similarity: match?.similarity || 0,
        metadata: {
          ...item.metadata,
          ...(item.division && {
            division: item.division.name,
            cluster: item.division.cluster,
            agency: item.division.agency
          })
        }
      };
    }) || [];
  };

  // Process each table in parallel
  const matchPromises = tables.map(async (table) => {
    try {
      const matches = await buildQuery(
        table,
        table === 'roles' || table === 'jobs' ? 'title' : 'name'
      );
      
      console.log(`${table} matches:`, {
        count: matches.length,
        matches: matches.map(m => ({
          id: m.id,
          name: m.name,
          similarity: m.similarity
        }))
      });

      results.push(...matches);
    } catch (error) {
      console.error(`Error processing ${table}:`, error);
    }
  });

  await Promise.all(matchPromises);

  // Sort by similarity and apply global limit
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Convert a JSON object to readable text format
 */
function jsonToReadableText(obj: Record<string, any>, indent = 0): string {
  const pad = '  '.repeat(indent);
  return Object.entries(obj)
    .filter(([key]) => !key.includes('id') && !key.includes('embedding')) // Filter out id and embedding fields
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        // Handle arrays - only include string values
        const stringValues = value.filter(v => typeof v === 'string');
        if (stringValues.length > 0) {
          return `${pad}${key}:\n${stringValues.map(v => `${pad}  ${v}`).join('\n')}`;
        }
        return '';
      } else if (typeof value === 'object' && value !== null) {
        const nestedText = jsonToReadableText(value, indent + 1);
        return nestedText ? `${pad}${key}:\n${nestedText}` : '';
      } else if (typeof value === 'string') {
        return `${pad}${key}: ${value}`;
      }
      return '';
    })
    .filter(text => text.length > 0) // Remove empty strings
    .join('\n');
}

/**
 * Helper to generate embeddings for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  console.log('Generating embedding for:', text);
  try {
    // Try to parse as JSON first
    let processedText = text;
    try {
      const jsonObj = JSON.parse(text);
      // If it's JSON, convert to readable text format
      if (typeof jsonObj === 'object' && jsonObj !== null) {
        processedText = jsonToReadableText(jsonObj);
        console.log('Processed text:', processedText);
      }
    } catch (e) {
      // Not JSON, use as is
      processedText = text;
    }

    // Ensure the text is not too long for the API
    if (processedText.length > 8000) {
      processedText = processedText.substring(0, 8000);
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: processedText
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${JSON.stringify(data.error || data)}`);
    }
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
} 