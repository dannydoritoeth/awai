'use client';

import { useEffect } from 'react';
import { useBookingModal } from '@/contexts/BookingModalContext';

export function CTASection() {
  const { openModal } = useBookingModal();

  return (
    <section className="py-20 bg-[#1A1A1A] text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-[1000px] mx-auto text-center">
          {/* Urgency Header */}
          <div className="mb-12">
            <p className="text-[#9FE870] text-xl font-semibold mb-4">
              ⚠️ LIMITED TIME OFFER
            </p>
            <h2 className="text-4xl md:text-6xl font-bold mb-6">
              Start Growing Today
              <span className="text-[#9FE870]">...</span>
            </h2>
            <p className="text-xl text-gray-300">
              And Pay Only When You Succeed
            </p>
          </div>

          {/* Decision Stack */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Path A - Do Nothing */}
            <div className="bg-gray-900 p-8 rounded-lg">
              <h3 className="text-2xl font-bold mb-6 text-gray-400">
                Path A: Do Nothing
              </h3>
              <ul className="space-y-4 text-left text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✕</span>
                  <span>Watch competitors dominate your territory</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✕</span>
                  <span>Stay stuck on the revenue plateau</span>
                </li>
              </ul>
            </div>

            {/* Path B - Take Action */}
            <div className="bg-[#0A2E4D] p-8 rounded-lg">
              <h3 className="text-2xl font-bold mb-6 text-[#9FE870]">
                Book Your Strategy Call Today
              </h3>
              <p className="text-gray-200 mb-4">
                Walk away with a complete marketing blueprint customized for your agency:
              </p>
              <ul className="space-y-4 text-left">
                <li className="flex items-start gap-2">
                  <span className="text-[#9FE870] mt-1">✓</span>
                  <span>Ideal client profile and pain point identification</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#9FE870] mt-1">✓</span>
                  <span>Actionable marketing plan with immediate and long-term strategies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#9FE870] mt-1">✓</span>
                  <span>Implementation roadmap your team can execute today</span>
                </li>
              </ul>
              <p className="text-gray-200 mt-4 text-sm italic">
                Yours to keep - even if you don't move forward with us
              </p>
            </div>
          </div>

          {/* Final Call To Action */}
          <div className="max-w-[600px] mx-auto">
            <button 
              onClick={openModal}
              className="block w-full text-xl px-10 py-6 bg-[#9FE870] text-black rounded-md 
                hover:bg-[#8FD860] transition-colors duration-300 
                shadow-lg hover:shadow-xl font-bold mb-4"
            >
              Book Your Free Strategy Call Now
            </button>
            <p className="text-sm text-gray-400 mb-6">
              Limited Time Offer - Book Now
            </p>

            {/* Trust Badges */}
            <div className="flex justify-center items-center gap-8">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#9FE870]">Fast</p>
                <p className="text-sm text-gray-400">Implementation</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#9FE870]">Proven</p>
                <p className="text-sm text-gray-400">System</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#9FE870]">Results</p>
                <p className="text-sm text-gray-400">Based Payment</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 