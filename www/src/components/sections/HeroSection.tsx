'use client';

import { useEffect } from 'react';

export function HeroSection() {
  return (
    <section className="pt-40 pb-16">
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

        {/* Subheadline */}
        <p className="text-gray-700 text-lg md:text-xl mb-16 max-w-[800px] mx-auto">
          Discover how our Precision Lead Engine™ can help your agency dominate your market without upfront costs.
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