'use client';

import { use, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import UnifiedResultsView from '@/app/components/UnifiedResultsView';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

// Component that uses useSearchParams
function ChatPageContent({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = searchParams.get('context') as 'profile' | 'role' | 'open';

  useEffect(() => {
    if (!context) {
      router.push('/');
    }
  }, [context, router]);

  // If no context is provided, show nothing while redirecting
  if (!context) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-[1200px]">
        <UnifiedResultsView
          startContext={context}
          sessionId={sessionId}
        />
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Loading conversation...</p>
      </div>
    </div>
  );
}

export default function ChatPage({ params }: PageProps) {
  const resolvedParams = use(params);
  
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ChatPageContent sessionId={resolvedParams.id} />
    </Suspense>
  );
} 