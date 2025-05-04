'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [query, setQuery] = useState('');
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set new height based on scrollHeight, with a max of 150px
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/c?context=open&query=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <main className="min-h-screen p-8">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <div className="bg-white/50 backdrop-blur-sm py-8 px-4 rounded-3xl shadow-sm">
          <h1 className="text-5xl font-bold text-blue-600 mb-4 tracking-tight">
            TalentPathAI
          </h1>
          <p className="text-2xl text-blue-950 font-medium">
            Intelligent HR matching for roles and candidates
          </p>
        </div>
      </div>

      {/* Main Menu */}
      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 mb-8">
          <Link 
            href="/c?context=employee"
            className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-blue-500"
          >
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-300">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Start with Your Profile
              </h2>
              <p className="text-gray-600">
                Find opportunities matching your experience
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
                Find candidates for a specific role
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
                      router.push(`/c?context=open&query=${encodeURIComponent(query.trim())}`);
                    }
                  }
                }}
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!query.trim()}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 text-center">
              Type your question about roles, candidates, or skills matching
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
