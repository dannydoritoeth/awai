'use client';

import Link from 'next/link';

export default function AppFailedPage() {
  return (
    <main className="min-h-screen bg-[#1B2A47] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-8 max-w-xl w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Connection Failed</h1>
          <p className="text-gray-600 mb-6">
            We encountered an issue while trying to connect to your HubSpot account.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h2 className="font-semibold mb-3">Common issues:</h2>
          <ul className="space-y-3 text-left">
            <li className="flex items-start gap-2">
              <span className="text-red-500">•</span>
              <span>Insufficient HubSpot permissions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500">•</span>
              <span>Connection timeout</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500">•</span>
              <span>API access restrictions</span>
            </li>
          </ul>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Need help? <a href="mailto:scott@acceleratewith.ai" className="text-blue-600 hover:underline">Contact our support team</a>
            </p>
          </div>
        </div>

        <div className="space-x-4">
          <button 
            onClick={() => window.location.reload()}
            className="bg-[#3B82F6] text-white px-6 py-3 rounded-md font-semibold hover:bg-[#2563EB] transition"
          >
            Try Again
          </button>
          <Link 
            href="/"
            className="inline-block border border-gray-300 text-gray-700 px-6 py-3 rounded-md font-semibold hover:bg-gray-50 transition"
          >
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
} 