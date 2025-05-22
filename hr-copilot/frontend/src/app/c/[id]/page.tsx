import { Suspense } from 'react';
import ChatPageClient from './ChatPageClient';

// Server Component
export default function ChatPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPageClient sessionId={params.id} />
    </Suspense>
  );
} 