'use client';

import { use, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import UnifiedResultsView from '@/app/components/UnifiedResultsView';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ChatPage({ params }: PageProps) {
  const resolvedParams = use(params);
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
          sessionId={resolvedParams.id}
        />
      </div>
    </div>
  );
} 