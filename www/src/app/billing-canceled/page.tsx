'use client';

import Link from 'next/link';

export default function BillingCanceledPage() {
  return (
    <main className="min-h-screen bg-[#1B2A47] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-8 max-w-xl w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Canceled</h1>
          <p className="text-gray-600 mb-6">
            Your payment process was canceled. No charges have been made to your account.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h2 className="font-semibold mb-3">What would you like to do?</h2>
          <ul className="space-y-3 text-left">
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-1">•</span>
              <span>Review our pricing plans again</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-1">•</span>
              <span>Contact support if you had any issues</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-1">•</span>
              <span>Return to the homepage</span>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <Link 
            href="/pricing"
            className="inline-block bg-[#3B82F6] text-white px-6 py-3 rounded-md font-semibold hover:bg-[#2563EB] transition w-full"
          >
            Return to Pricing
          </Link>
          <Link 
            href="/"
            className="inline-block bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-semibold hover:bg-gray-200 transition w-full"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </main>
  );
} 