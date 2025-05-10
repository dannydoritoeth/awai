import { createClient } from '@supabase/supabase-js';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing environment variable NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing environment variable NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Initialize Supabase client with environment variables
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export interface ChatSession {
  id: string;
  created_at: string;
  mode: 'general' | 'hiring' | 'candidate';
  summary?: string | null;
  title?: string;
  context?: {
    role_id?: string;
    candidate_id?: string;
  };
}

function generateTitle(session: ChatSession): string {
  const date = new Date(session.created_at);
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(date);

  if (session.summary) {
    return session.summary;
  }

  const modeLabels = {
    general: 'General Chat',
    hiring: 'Hiring Discussion',
    candidate: 'Candidate Review'
  };

  return `${modeLabels[session.mode]} - ${formattedDate}`;
}

export async function loadChatSessions(): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('conversation_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading chat sessions:', error);
    return [];
  }

  // Add generated titles to the sessions
  return (data || []).map(session => ({
    ...session,
    title: generateTitle(session)
  }));
} 