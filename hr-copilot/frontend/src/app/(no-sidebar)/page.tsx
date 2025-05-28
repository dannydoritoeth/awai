'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-8 pt-8">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">

            <div className="max-w-xl pt-8 pl-5">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">TalentPathAI Beta</h1>
                <div className="group relative">
                  <button className="text-gray-400 hover:text-gray-600" aria-label="Information about TalentPathAI Beta">
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div className="invisible group-hover:visible absolute left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-sm text-gray-600 z-10">
                    <b>What is TalentPathAI?</b><br/>
                    This prototype explores role mobility and career pathways across large government and private organisations. See how AI can identify internal movement opportunities, uncover skill gaps, and streamline hiring.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
              <p className="text-sm text-gray-600 mt-1 w-3/4">AI Powered Workforce Intelligence and Automation</p>
              </div>
            </div>
          </div>
          <Link href="#" className="pt-10 pr-10 text-blue-600 hover:text-blue-800">Feedback</Link>
        </div>

        <h1 className="text-4xl font-bold mb-12 text-gray-900 mt-24">What would you like to do?</h1>

        {/* Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Link href="/c?context=role" className="block h-full">
            <div className="bg-white border-2 border-blue-100 p-6 rounded-lg shadow-sm hover:border-blue-500 transition-all h-full flex flex-col">
              <div className="mb-4">
                <svg className="w-8 h-8 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2 text-gray-900">Start with a role</h2>
              <p className="text-gray-700">View career paths, related transitions</p>
            </div>
          </Link>

          <Link href="/c?context=profile" className="block h-full">
            <div className="bg-white border-2 border-green-100 p-6 rounded-lg shadow-sm hover:border-green-500 transition-all h-full flex flex-col">
              <div className="mb-4">
                <svg className="w-8 h-8 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2 text-gray-900">Start with a person</h2>
              <p className="text-gray-700">Match skills to potential roles, plan next steps</p>
            </div>
          </Link>

          <Link href="/insights" className="block h-full">
            <div className="bg-white border-2 border-purple-100 p-6 rounded-lg shadow-sm hover:border-purple-500 transition-all h-full flex flex-col">
              <div className="mb-4">
                <svg className="w-8 h-8 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2 text-gray-900">Start with insight</h2>
              <p className="text-gray-700">Explore insights on workforce and role patterns</p>
            </div>
          </Link>

          <Link href="/c?context=chat" className="block h-full">
            <div className="bg-white border-2 border-orange-100 p-6 rounded-lg shadow-sm hover:border-orange-500 transition-all h-full flex flex-col">
              <div className="mb-4">
                <svg className="w-8 h-8 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2 text-gray-900">Start a conversation</h2>
              <p className="text-gray-700">Chat with AI for career guidance</p>
            </div>
          </Link>
        </div>

        {/* Exploration Section */}
        <h2 className="text-3xl font-bold mb-8 text-gray-900">Explore careers by...</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Career Type */}
          <Link href="/taxonomies?type=career" className="block h-full">
            <div className="bg-white border-2 border-red-100 p-6 rounded-lg shadow-sm hover:border-red-500 transition-all h-full">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-red-100 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Career Type</h3>
              </div>
              <p className="text-gray-700">Policy, Projects, Field Work, HR...</p>
            </div>
          </Link>

          {/* Where You Work */}
          <Link href="/taxonomies?type=location" className="block h-full">
            <div className="bg-white border-2 border-green-100 p-6 rounded-lg shadow-sm hover:border-green-500 transition-all h-full">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-green-100 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Where You Work</h3>
              </div>
              <p className="text-gray-700">Explore by region or remote opportunities</p>
            </div>
          </Link>

          {/* Agency or Department */}
          <Link href="/companies" className="block h-full">
            <div className="bg-white border-2 border-blue-100 p-6 rounded-lg shadow-sm hover:border-blue-500 transition-all h-full">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Agency or Division</h3>
              </div>
              <p className="text-gray-700">Roles in DCCEEW, Health, Planning, etc.</p>
            </div>
          </Link>

          {/* Skills You Have */}
          <Link href="/skills" className="block h-full">
            <div className="bg-white border-2 border-red-100 p-6 rounded-lg shadow-sm hover:border-red-500 transition-all h-full">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-red-100 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Skills You Have</h3>
              </div>
              <p className="text-gray-700">Start from what you&apos;re good at</p>
            </div>
          </Link>

          {/* What You Want to Learn */}
          <Link href="/capabilities" className="block h-full">
            <div className="bg-white border-2 border-blue-100 p-6 rounded-lg shadow-sm hover:border-blue-500 transition-all h-full">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">What You Want to Learn</h3>
              </div>
              <p className="text-gray-700">Explore roles using capability you want to grow</p>
            </div>
          </Link>

          {/* People Like You */}
          <Link href="/transitions" className="block h-full">
            <div className="bg-white border-2 border-gray-100 p-6 rounded-lg shadow-sm hover:border-gray-500 transition-all h-full">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900">People Like You</h3>
              </div>
              <p className="text-gray-700">Explore popular transitions from your current role</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-8">
          {/* Empty footer for spacing */}
        </div>
      </footer>
    </main>
  );
} 