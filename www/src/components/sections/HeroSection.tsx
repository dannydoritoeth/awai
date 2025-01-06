'use client';

import { useEffect } from 'react';

export function HeroSection() {
  return (
    <section className="pt-32 pb-16">
      <div className="container mx-auto px-4 text-center">
        {/* Target Audience */}
        <p className="text-gray-600 text-lg md:text-xl mb-16">
          For Sales Teams Who Want to <span className="underline">Earn More</span> and <span className="underline">Work Less</span>
        </p>

        {/* Main Headline */}
        <h1 className="text-[2.75rem] md:text-[3.5rem] leading-[1.2] font-bold mb-6 text-gray-900 max-w-[900px] mx-auto">
          LET US BUILD YOU A{' '}
          <span className="text-[#0066FF]">READY-TO-USE</span>
          {' '}AI SYSTEM FOR YOUR BUSINESS
        </h1>

        {/* Subheadline */}
        <p className="text-gray-700 text-lg md:text-xl mb-16 max-w-[800px] mx-auto">
          Discover how our AI-powered solutions can transform your business operations, 
          boost efficiency, and drive unprecedented growth - without the complexity
        </p>

        {/* CTA Button */}
        <a 
          href="#book-call"
          className="inline-block text-xl px-10 py-5 bg-[#0A2E4D] text-white rounded-md 
            hover:bg-[#164875] transition-colors duration-300 
            shadow-lg hover:shadow-xl"
        >
          Book Your Free Strategy Call
        </a>
      </div>
    </section>
  );
} 