'use client';

import { useEffect } from 'react';
import { useBookingModal } from '@/contexts/BookingModalContext';

export function HeroSection() {
  const { openModal } = useBookingModal();
  
  return (
    <section className="pb-16">
      <div className="container mx-auto px-4 text-center">
        {/* Eyebrow - Target Industry */}
        <p className="text-[#0066FF] font-semibold text-lg md:text-xl mb-8">
          Attention Real Estate Agencies Ready to Scale Faster and Smarter!
        </p>

        {/* Main Headline */}
        <h1 className="text-[4rem] md:text-[7rem] leading-[1] font-bold mb-6 text-gray-900 max-w-[1200px] mx-auto tracking-tight">
          EXPLODE YOUR{' '}
          <br />
          SALES PIPELINE
        </h1>

        {/* Social Proof */}
        <p className="text-2xl text-gray-700 mb-8">
          Join <span className="font-bold">100+ Real Estate Agencies</span> Already Using Our System
        </p>

        {/* Specific Promise */}
        <p className="text-[#0066FF] text-2xl font-bold mb-16">
          Get 50+ Exclusive Listings Per Month - Guaranteed
        </p>

        {/* Subheadline */}
        <p className="text-gray-700 text-lg md:text-xl mb-8 max-w-[800px] mx-auto">
          Discover how our Precision Lead Engine™ can help your agency dominate your market without upfront costs.
        </p>

        {/* Scarcity */}
        <p className="text-red-600 font-semibold mb-8">
          ⚠️ Warning: We only work with one agency per territory
        </p>

        {/* CTA Button */}
        <div className="space-y-4">
          <button 
            onClick={openModal}
            className="inline-block text-xl px-10 py-5 bg-[#0A2E4D] text-white rounded-md 
              hover:bg-[#164875] transition-colors duration-300 
              shadow-lg hover:shadow-xl"
          >
            Claim Your Territory Now - Free Strategy Call (Worth $1,000)
          </button>
          <p className="text-gray-600 text-sm">
            Only 2 Spots Left In Your Area - Book Now
          </p>
        </div>
      </div>
    </section>
  );
} 