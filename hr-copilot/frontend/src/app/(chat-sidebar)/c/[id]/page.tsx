import { Suspense } from 'react';
import ChatPageClient from './ChatPageClient';

// Server Component
export default async function ChatPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPageClient sessionId={params.id} />
    </Suspense>
  );
} 