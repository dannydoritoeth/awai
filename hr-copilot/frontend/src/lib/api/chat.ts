interface StartSessionRequest {
  action: 'startSession';
  profileId?: string;
  roleId?: string;
  message: string;
  browserSessionId: string;
}

interface StartSessionResponse {
  sessionId: string;
  mode: 'candidate' | 'hiring' | 'general';
  entityId?: string;
  error?: string;
}

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface ResponseData {
  content?: string;
  metadata?: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  sessionId: string;
  sender: 'user' | 'assistant';
  message: string;
  timestamp: string;
  toolCall?: ToolCall;
  responseData?: ResponseData;
}

export async function startSession(req: StartSessionRequest): Promise<StartSessionResponse> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify(req)
  });

  const data = await response.json();

  if (!response.ok) {
    // If the server returned an error object, use that
    if (data.error) {
      throw new Error(`Failed to start session: ${data.error.message || data.error}`);
    }
    // Otherwise use the status text
    throw new Error(`Failed to start session: ${response.statusText}`);
  }

  // Check if we got a valid session ID
  if (!data.sessionId) {
    throw new Error('Failed to start session: No session ID returned');
  }

  return data;
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/chat_messages?session_id=eq.${sessionId}&order=timestamp.asc`, {
    headers: {
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.statusText}`);
  }

  return response.json();
} 