'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { startSession } from '@/lib/api/chat';
import { getBrowserSessionId } from '@/lib/browserSession';
import { events, EVENT_NAMES } from '@/lib/events';

export default function Home() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      const browserSessionId = getBrowserSessionId();
      const response = await startSession({
        action: 'startSession',
        message: query.trim(),
        browserSessionId
      });
      console.log('startSession response:', response);
      if (!response.sessionId) {
        setError('No sessionId returned from API.');
        setIsLoading(false);
        return;
      }
      events.emit(EVENT_NAMES.SESSION_CREATED);
      router.push(`/c/${response.sessionId}?context=open`);
    } catch (error: unknown) {
      console.error('Failed to start session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start session.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <div className="bg-white/50 backdrop-blur-sm py-8 px-4 rounded-3xl shadow-sm">
          <h1 className="text-5xl font-bold text-blue-600 mb-4 tracking-tight">
            Welcome to the TalentPathAI Demo
          </h1>
          <p className="text-2xl text-blue-950 font-medium mb-8">
            Explore intelligent HR matching using real DCCEEW public sector role data and synthetic candidate profiles.
          </p>

          <div className="text-xl text-blue-950 space-y-4 mb-8">
            <p className="flex items-center justify-left gap-3">
              <span>🔍</span> Start with a Profile – Discover which roles align with a sample employee&apos;s skills
            </p>
            <p className="flex items-center justify-left gap-3">
              <span>🧩</span> Start with a Role – Find matching candidates from our generated talent pool
            </p>
            <p className="flex items-center justify-left gap-3">
              <span>📊</span> Explore Insights – Analyze capability distribution and workforce trends
            </p>
            <p className="flex items-center justify-left gap-3">
              <span>💬</span> Chat with the Platform – Ask anything about roles, skills, or candidate fit
            </p>
          </div>

          <p className="text-lg text-blue-950/80 italic">
          This demo showcases AI-powered matching between real job descriptions and auto-generated candidate profiles. All data is anonymised and intended for demonstration purposes only.
          </p>
        </div>
      </div>

      {/* Main Menu */}
      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 mb-8">
          <Link 
            href="/c?context=profile"
            className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-blue-500"
          >
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-300">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Start with a Profile
              </h2>
              <p className="text-gray-600">
                Find suitable roles for a professional profile
              </p>
            </div>
          </Link>

          <Link 
            href="/c?context=role"
            className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-green-500"
          >
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center group-hover:bg-green-200 transition-colors duration-300">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Start with a Role
              </h2>
              <p className="text-gray-600">
                Find suitable candidates for a specific role
              </p>
            </div>
          </Link>

          <Link 
            href="/insights"
            className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-purple-500"
          >
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center group-hover:bg-purple-200 transition-colors duration-300">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Explore Insights
              </h2>
              <p className="text-gray-600">
                Analyze organizational capabilities and trends
              </p>
            </div>
          </Link>
        </div>

        {/* Chat Input Section */}
        <div className="bg-white p-8 rounded-2xl shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900 text-center mb-4">
              Start a Conversation
            </h2>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask me anything about roles or candidates..."
                className="w-full resize-none rounded-xl border-none focus:border-none focus:outline-none focus:ring-0 bg-gray-50 text-gray-900 placeholder:text-gray-500 text-sm py-3 px-4 min-h-[48px] max-h-[150px]"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (query.trim()) {
                      handleSubmit(e);
                    }
                  }
                }}
                disabled={isLoading}
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!query.trim() || isLoading}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
              </button>
            </div>
            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
            <p className="text-sm text-gray-500 text-center">
              Type your question about roles, candidates, or skills matching
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
