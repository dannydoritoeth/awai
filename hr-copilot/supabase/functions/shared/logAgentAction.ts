import { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseResponse } from './types';

export type EntityType = 'profile' | 'role' | 'job';

export interface AgentAction {
  id: string;
  entityType: EntityType;
  entityId: string;
  payload: Record<string, any>;
  createdAt: string;
}

export async function logAgentAction(
  supabase: SupabaseClient,
  entityType: EntityType,
  entityId: string,
  payload: Record<string, any>,
  options: {
    agentId?: string;
    confidence?: number;
    source?: string;
  } = {}
): Promise<DatabaseResponse<AgentAction>> {
  try {
    // Validate inputs
    if (!entityId?.trim()) {
      return {
        data: null,
        error: {
          type: 'INVALID_INPUT',
          message: 'Entity ID is required'
        }
      };
    }

    if (!payload || Object.keys(payload).length === 0) {
      return {
        data: null,
        error: {
          type: 'INVALID_INPUT',
          message: 'Payload cannot be empty'
        }
      };
    }

    // Prepare the action record with optional fields
    const actionRecord = {
      entity_type: entityType,
      entity_id: entityId,
      payload: {
        ...payload,
        ...(options.agentId && { agentId: options.agentId }),
        ...(options.confidence && { confidence: options.confidence }),
        ...(options.source && { source: options.source }),
        timestamp: new Date().toISOString()
      }
    };

    // Insert the action
    const { data, error } = await supabase
      .from('agent_actions')
      .insert(actionRecord)
      .select()
      .single();

    if (error) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to log agent action',
          details: error
        }
      };
    }

    // Transform the response to match the AgentAction interface
    const agentAction: AgentAction = {
      id: data.id,
      entityType: data.entity_type,
      entityId: data.entity_id,
      payload: data.payload,
      createdAt: data.created_at
    };

    return {
      data: agentAction,
      error: null
    };

  } catch (error) {
    return {
      data: null,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to log agent action',
        details: error
      }
    };
  }
}

// Helper function to ensure consistent payload schema across different action types
export function createActionPayload(
  actionType: string,
  details: Record<string, any>
): Record<string, any> {
  return {
    type: actionType,
    details,
    version: '1.0' // For future schema versioning
  };
} 