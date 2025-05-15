import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChatMessage } from '@/types/chat';

// Initialize Supabase client with error handling
const initializeSupabase = (): SupabaseClient | null => {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables');
      return null;
    }

    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: { persistSession: false }
      }
    );
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
};

export const supabase = initializeSupabase();

interface PollingState {
  isPolling: boolean;
  lastPollTime: number;
  timeout: NodeJS.Timeout | null;
}

export class ChatPoller {
  private state: PollingState = {
    isPolling: false,
    lastPollTime: 0,
    timeout: null
  };
  private readonly sessionId: string;
  private readonly onNewMessages: (messages: ChatMessage[]) => void;
  private readonly onError: (error: Error) => void;
  private readonly pollInterval: number;
  private readonly seenMessageIds: Set<string>;
  private isMounted: boolean;

  constructor(
    sessionId: string,
    onNewMessages: (messages: ChatMessage[]) => void,
    onError: (error: Error) => void,
    pollInterval = 2000
  ) {
    this.sessionId = sessionId;
    this.onNewMessages = onNewMessages;
    this.onError = onError;
    this.pollInterval = pollInterval;
    this.seenMessageIds = new Set();
    this.isMounted = true;
  }

  public start(): void {
    if (!supabase) {
      this.onError(new Error('Supabase client not initialized'));
      return;
    }
    this.poll();
  }

  public stop(): void {
    this.isMounted = false;
    if (this.state.timeout) {
      clearTimeout(this.state.timeout);
      this.state.timeout = null;
    }
    this.state.isPolling = false;
  }

  private async poll(): Promise<void> {
    if (!this.isMounted || !supabase) {
      return;
    }

    if (this.state.isPolling) {
      console.debug('Already polling, skipping this cycle');
      return;
    }

    const now = Date.now();
    if (now - this.state.lastPollTime < this.pollInterval) {
      console.debug('Too soon to poll, scheduling next poll');
      this.schedulePoll();
      return;
    }

    try {
      this.state.isPolling = true;
      this.state.lastPollTime = now;

      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', this.sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      if (!messages) {
        console.debug('No messages returned from query');
        return;
      }

      // Filter out messages we've already seen
      const newMessages = messages.filter(msg => !this.seenMessageIds.has(msg.id));

      // Update seen message IDs
      newMessages.forEach(msg => this.seenMessageIds.add(msg.id));

      if (newMessages.length > 0) {
        const transformedMessages: ChatMessage[] = newMessages.map(msg => ({
          id: msg.id,
          sessionId: msg.session_id,
          sender: msg.sender === 'assistant' ? 'assistant' : 'user',
          message: msg.message,
          timestamp: new Date(msg.created_at).toISOString(),
          toolCall: msg.tool_call ? {
            name: msg.tool_call.name,
            arguments: msg.tool_call.arguments
          } : undefined,
          responseData: msg.response_data,
          followUpQuestion: msg.response_data?.followUpQuestion,
          semanticContext: msg.response_data?.semanticContext
        }));
        
        this.onNewMessages(transformedMessages);
      }
    } catch (error) {
      console.error('Error polling messages:', error);
      this.onError(error instanceof Error ? error : new Error('Failed to poll messages'));
    } finally {
      this.state.isPolling = false;
      this.schedulePoll();
    }
  }

  private schedulePoll(): void {
    if (!this.isMounted) {
      return;
    }

    if (this.state.timeout) {
      clearTimeout(this.state.timeout);
    }

    this.state.timeout = setTimeout(() => {
      this.poll();
    }, this.pollInterval);
  }
} 