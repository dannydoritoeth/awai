'use client';

import Link from 'next/link';

export default function BillingSuccessPage() {
  return (
    <main className="min-h-screen bg-[#1B2A47] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-8 max-w-xl w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for your payment. Your subscription has been successfully activated.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h2 className="font-semibold mb-3">What happens next?</h2>
          <ul className="space-y-3 text-left">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">✓</span>
              <span>Your subscription is now active</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">✓</span>
              <span>You have full access to all features included in your plan</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">✓</span>
              <span>You can start using the service immediately</span>
            </li>
          </ul>
        </div>

        <Link 
          href="/"
          className="inline-block bg-[#3B82F6] text-white px-6 py-3 rounded-md font-semibold hover:bg-[#2563EB] transition"
        >
          Go to Homepage
        </Link>
      </div>
    </main>
  );
} 