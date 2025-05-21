export interface AgentAction {
  entityType: 'profile' | 'role' | 'job';
  entityId: string;
  payload: {
    action: string;
    reason?: string;
    result?: any;
  };
  requestHash?: string;
  actionType?: string;
}

export interface DependenciesV2 {
  generateEmbedding: (text: string) => Promise<number[]>;
  getConversationContext: (supabase: any, sessionId: string) => Promise<any>;
  invokeChatModel: (messages: any, options: any) => Promise<any>;
  findExistingActionResult?: (supabase: any, actionType: string, requestHash: string) => Promise<any>;
} 