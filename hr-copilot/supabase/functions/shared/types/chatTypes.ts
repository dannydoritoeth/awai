import { ResponseData, HeatmapRequestData } from './responseTypes.ts';

/**
 * Base chat message interface with common fields
 */
export interface BaseChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
}

/**
 * Extended chat message for MCP loop
 */
export interface MCPChatMessage extends BaseChatMessage {
  toolCall?: {
    tool: string;
    args: Record<string, any>;
  };
}

/**
 * Extended chat message for frontend
 */
export interface FrontendChatMessage extends BaseChatMessage {
  sender: 'user' | 'assistant';
  message: string; // Alias for content for backward compatibility
  response_data?: ResponseData | HeatmapRequestData;
  followUpQuestion?: string;
  semanticContext?: {
    relevantText?: string;
    confidence?: number;
  };
}

/**
 * Extended chat message for Supabase storage
 */
export interface StorageChatMessage extends BaseChatMessage {
  sessionId: string;
  toolCall?: Record<string, any>;
  responseData?: Record<string, any>;
}

/**
 * Type guard to check if a message is an MCP chat message
 */
export function isMCPChatMessage(message: BaseChatMessage): message is MCPChatMessage {
  return 'toolCall' in message && typeof (message as MCPChatMessage).toolCall?.tool === 'string';
}

/**
 * Type guard to check if a message is a frontend chat message
 */
export function isFrontendChatMessage(message: BaseChatMessage): message is FrontendChatMessage {
  return 'sender' in message && 'message' in message;
}

/**
 * Type guard to check if a message is a storage chat message
 */
export function isStorageChatMessage(message: BaseChatMessage): message is StorageChatMessage {
  return 'sessionId' in message;
}

/**
 * Convert between different chat message types
 */
export function convertChatMessage(message: BaseChatMessage, targetType: 'mcp' | 'frontend' | 'storage'): BaseChatMessage {
  switch (targetType) {
    case 'mcp':
      return {
        id: message.id,
        content: 'message' in message ? (message as FrontendChatMessage).message : message.content,
        role: message.role,
        timestamp: message.timestamp,
        toolCall: isMCPChatMessage(message) ? message.toolCall : undefined
      } as MCPChatMessage;

    case 'frontend':
      return {
        id: message.id,
        content: message.content,
        message: message.content,
        sender: message.role === 'system' ? 'assistant' : message.role,
        role: message.role,
        timestamp: message.timestamp,
        response_data: isFrontendChatMessage(message) ? message.response_data : undefined,
        followUpQuestion: isFrontendChatMessage(message) ? message.followUpQuestion : undefined,
        semanticContext: isFrontendChatMessage(message) ? message.semanticContext : undefined
      } as FrontendChatMessage;

    case 'storage':
      return {
        id: message.id,
        content: message.content,
        role: message.role,
        timestamp: message.timestamp,
        sessionId: isStorageChatMessage(message) ? message.sessionId : '',
        toolCall: isStorageChatMessage(message) ? message.toolCall : undefined,
        responseData: isStorageChatMessage(message) ? message.responseData : undefined
      } as StorageChatMessage;

    default:
      return message;
  }
} 