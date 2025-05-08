import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'
import { getJobReadiness } from '../shared/job/getJobReadiness.ts'
import { getCapabilityGaps } from '../shared/profile/getCapabilityGaps.ts'
import { getSkillGaps } from '../shared/profile/getSkillGaps.ts'
import { getProfileContext } from '../shared/profile/getProfileContext.ts'
import { getSuggestedCareerPaths } from '../shared/profile/getSuggestedCareerPaths.ts'
import { getRoleDetail } from '../shared/role/getRoleDetail.ts'
import { getOpenJobs } from '../shared/job/getOpenJobs.ts'
import { getMatchingProfiles } from '../shared/role/getMatchingProfiles.ts'
import { scoreProfileFit } from '../shared/agent/scoreProfileFit.ts'
import { getSemanticMatches, embedContext } from '../shared/embeddings.ts'
import { testJobMatching } from '../shared/job/testJobMatching.ts'
import { getHiringMatches } from '../shared/job/hiringMatches.ts'

interface TestFunctionRequest {
  function: string;
  [key: string]: any;
}

// Function parameter validation schemas
const functionSchemas = {
  jobReadiness: {
    required: ['profileId', 'jobId'],
    validate: (params: any) => {
      return params.profileId && params.jobId;
    }
  },
  capabilityGaps: {
    required: ['profileId', 'targetRoleId'],
    validate: (params: any) => {
      return params.profileId && params.targetRoleId;
    }
  },
  skillGaps: {
    required: ['profileId', 'targetRoleId'],
    validate: (params: any) => {
      return params.profileId && params.targetRoleId;
    }
  },
  profileContext: {
    required: ['profileId'],
    validate: (params: any) => {
      return params.profileId;
    }
  },
  suggestedCareerPaths: {
    required: ['profileId'],
    validate: (params: any) => {
      return params.profileId;
    }
  },
  roleDetail: {
    required: ['roleId'],
    validate: (params: any) => {
      return params.roleId;
    }
  },
  openJobs: {
    required: [],
    validate: () => true
  },
  matchingProfiles: {
    required: ['roleId'],
    validate: (params: any) => {
      return params.roleId;
    }
  },
  scoreProfileFit: {
    required: ['profileId', 'roleId'],
    validate: (params: any) => {
      return params.profileId && params.roleId;
    }
  },
  semanticMatches: {
    required: ['embedding', 'targetTable', 'limit', 'minScore'],
    validate: (params: any) => {
      return params.embedding && params.targetTable && 
             typeof params.limit === 'number' && 
             typeof params.minScore === 'number';
    }
  }
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Read request body once
    const requestData = await req.json()
    const { 
      action, 
      profileId, 
      limit, 
      threshold,
      sourceId,
      sourceTable,
      targetTable 
    } = requestData

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    )

    let result

    switch (action) {
      case 'testJobMatching':
        if (!profileId) {
          throw new Error('profileId is required for job matching test')
        }
        result = await testJobMatching(supabaseClient, profileId, {
          limit: limit || 20,
          threshold: threshold || 0.7
        })
        break

      case 'testEmbeddings':
        const { function: functionName, params } = requestData;
        console.log(`Testing embedding function: ${functionName}`, params);

        switch (functionName) {
          case 'embedContext':
            if (!params.entityType || !params.entityId) {
              throw new Error('entityType and entityId are required for embedContext');
            }
            result = await embedContext(supabaseClient, params.entityType, params.entityId);
            break;

          case 'match_embeddings_by_vector':
            if (!params.queryEmbedding || !params.tableName) {
              throw new Error('queryEmbedding and tableName are required for match_embeddings_by_vector');
            }
            result = await supabaseClient.rpc('match_embeddings_by_vector', {
              p_query_embedding: params.queryEmbedding,
              p_table_name: params.tableName,
              p_match_threshold: params.matchThreshold || 0.5,
              p_match_count: params.matchCount || 10
            });
            break;

          case 'match_embeddings_by_id':
            if (!params.entityId || !params.tableName) {
              throw new Error('entityId and tableName are required for match_embeddings_by_id');
            }
            result = await supabaseClient.rpc('match_embeddings_by_id', {
              p_query_id: params.entityId,
              p_table_name: params.tableName,
              p_match_threshold: params.matchThreshold || 0.5,
              p_match_count: params.matchCount || 10
            });
            break;

          case 'calculate_embedding_similarity':
            if (!params.sourceId || !params.targetId || !params.sourceTable || !params.targetTable) {
              throw new Error('sourceId, targetId, sourceTable, and targetTable are required for calculate_embedding_similarity');
            }
            result = await supabaseClient.rpc('calculate_embedding_similarity', {
              source_id: params.sourceId,
              target_id: params.targetId,
              source_table: params.sourceTable,
              target_table: params.targetTable
            });
            break;

          case 'get_embedding':
            if (!params.entityId || !params.tableName) {
              throw new Error('entityId and tableName are required for get_embedding');
            }
            result = await supabaseClient
              .from(params.tableName)
              .select('id, embedding')
              .eq('id', params.entityId)
              .single();
            break;

          default:
            throw new Error(`Function ${functionName} not implemented`);
        }
        break

      case 'testHiringMatches':
        if (!profileId) {
          throw new Error('profileId is required for hiring matches test')
        }
        console.log('Testing hiring matches for profile:', profileId)
        result = await getHiringMatches(supabaseClient, profileId, {
          limit: limit || 5,
          threshold: threshold || 0.3,
          maxConcurrent: 5
        })
        break

      case 'testSemanticMatching':
        if (!sourceId || !sourceTable || !targetTable) {
          throw new Error('sourceId, sourceTable, and targetTable are required for semantic matching test')
        }
        
        // Use a lower threshold for testing
        const testThreshold = threshold || 0.1 // Lowered from 0.3 to 0.1 for testing
        
        console.log('Starting semantic matching test with params:', {
          sourceId,
          sourceTable,
          targetTable,
          limit: limit || 5,
          threshold: testThreshold
        })

        // First verify source exists
        const selectFields = sourceTable === 'roles' ? 'id, title, embedding' : 'id, name, embedding'
        console.log('Selecting fields:', selectFields, 'from table:', sourceTable)
        const { data: source, error: sourceError } = await supabaseClient
          .from(sourceTable)
          .select(selectFields)
          .eq('id', sourceId)
          .single()

        if (sourceError || !source) {
          console.error('Source query error:', sourceError)
          throw new Error(`Source ${sourceTable} with ID ${sourceId} not found: ${sourceError?.message}`)
        }

        // Transform the response to have a consistent name field
        const sourceData = sourceTable === 'roles' ? { ...source, name: source.title } : source

        // Check embedding
        if (!sourceData.embedding) {
          console.warn('Source has no embedding - attempting to get matches anyway:', {
            table: sourceTable,
            id: sourceId,
            name: sourceData.name || sourceData.title
          })
        } else {
          console.log('Source embedding found:', {
            table: sourceTable,
            id: sourceId,
            name: sourceData.name || sourceData.title,
            embeddingLength: sourceData.embedding.length
          })
        }

        // Check role requirements if this is a role
        if (sourceTable === 'roles') {
          console.log('Checking role requirements for:', sourceId)
          const { data: requirements, error: reqError } = await supabaseClient
            .from('role_requirements')
            .select('*')
            .eq('role_id', sourceId)

          console.log('Role requirements check:', {
            roleId: sourceId,
            hasRequirements: requirements && requirements.length > 0,
            requirementCount: requirements?.length || 0,
            error: reqError
          })

          // Also check role capabilities
          const { data: capabilities, error: capError } = await supabaseClient
            .from('role_capabilities')
            .select('*')
            .eq('role_id', sourceId)

          console.log('Role capabilities check:', {
            roleId: sourceId,
            hasCapabilities: capabilities && capabilities.length > 0,
            capabilityCount: capabilities?.length || 0,
            error: capError
          })
        }

        // Attempt to get semantic matches
        console.log('Fetching semantic matches...')
        const matches = await getSemanticMatches(
          supabaseClient,
          { id: sourceId, table: sourceTable },
          targetTable,
          limit || 5,
          testThreshold
        )

        // Log detailed match information
        console.log('Semantic matching results:', {
          matchCount: matches.length,
          threshold: testThreshold,
          matches: matches.map(m => ({
            id: m.id,
            type: m.type,
            similarity: m.similarity,
            name: m.name
          }))
        })

        // If this is a role looking for profiles, calculate profile fit with correct parameter order
        if (sourceTable === 'roles') {
          console.log('Calculating profile fits for matches...')
          const profileFits = await Promise.all(
            matches.map(async (match) => {
              try {
                // Corrected order: roleId first (sourceId), then profileId (match.id)
                const fitResult = await scoreProfileFit(supabaseClient, sourceId, match.id)
                return {
                  ...match,
                  fit: fitResult.data
                }
              } catch (error) {
                console.error('Error calculating profile fit:', {
                  roleId: sourceId,
                  profileId: match.id,
                  error: error.message
                })
                return match
              }
            })
          )

          // Update matches with fit scores
          matches.length = 0
          matches.push(...profileFits)
        }

        // If no matches, check target table for embeddings
        if (matches.length === 0) {
          const { count } = await supabaseClient
            .from(targetTable)
            .select('*', { count: 'exact', head: true })
            .not('embedding', 'is', null)
          
          console.log(`${targetTable} embedding stats:`, {
            totalWithEmbeddings: count
          })
        }

        result = {
          success: true,
          matches,
          debug: {
            sourceFound: true,
            hasEmbedding: !!sourceData.embedding,
            matchCount: matches.length,
            sourceInfo: {
              id: sourceId,
              name: sourceData.name || sourceData.title,
              hasEmbedding: !!sourceData.embedding
            },
            matches: matches.map(m => ({
              id: m.id,
              type: m.type,
              similarity: m.similarity,
              name: m.name
            }))
          }
        }
        break

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}) 