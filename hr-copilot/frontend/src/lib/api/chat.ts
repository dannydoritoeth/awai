interface StartSessionRequest {
  action: 'startSession';
  profileId?: string;
  roleId?: string;
  message: string;
}

interface StartSessionResponse {
  sessionId: string;
  mode: 'candidate' | 'hiring' | 'general';
  entityId?: string;
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
  session_id: string;
  sender: 'user' | 'assistant';
  message: string;
  timestamp: string;
  tool_call?: ToolCall;
  response_data?: ResponseData;
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

  if (!response.ok) {
    throw new Error(`Failed to start session: ${response.statusText}`);
  }

  return response.json();
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