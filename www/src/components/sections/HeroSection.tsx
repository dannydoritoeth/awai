'use client';

import { useBookingModal } from '@/contexts/BookingModalContext';

export function HeroSection() {
  const { openModal } = useBookingModal();
  
  return (
    <section className="relative min-h-screen bg-gradient-to-br from-[#0A2E4D] to-[#1A1A1A] overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient Orbs */}
        <div className="absolute top-20 left-20 w-96 h-96 bg-[#1A90FF]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#9FE870]/10 rounded-full blur-3xl" />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[url('/assets/patterns/grid.svg')] opacity-5" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4 text-center pt-16">
        {/* Eyebrow - Target Industry */}
        <p className="text-[#1A90FF] font-semibold text-lg md:text-xl mb-6">
          Real Estate Agencies: Scale Your Business Risk-Free
        </p>

        {/* Main Headline */}
        <h1 className="text-[4rem] md:text-[7rem] leading-[1] font-bold mb-4 text-white max-w-[1200px] mx-auto tracking-tight drop-shadow-lg">
          EXPLODE YOUR{' '}
          <br />
          SALES PIPELINE
        </h1>

        {/* Subheadline */}
        <p className="text-gray-100 text-lg md:text-xl mb-6 max-w-[800px] mx-auto">
          Our success is tied directly to yours. With our performance-based model, you only pay when deals close.
        </p>

        {/* Value Prop for Strategy Call */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 rounded-lg mb-8 max-w-[800px] mx-auto shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="bg-[#9FE870]/10 px-4 py-2 rounded-full border border-[#9FE870]/20">
              <span className="text-[#9FE870] font-bold">$2,500 Value</span>
            </div>
          </div>
          <h3 className="text-[#9FE870] text-xl font-bold mb-4">
            Get Your Free Custom Paid Marketing Strategy
          </h3>
          <div className="text-left space-y-3 text-gray-100">
            <p className="flex items-start gap-2">
              <span className="text-[#9FE870] mt-1">✓</span>
              <span>Ideal client profile and pain point identification</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[#9FE870] mt-1">✓</span>
              <span>Detailed marketing strategy for both immediate wins and long-term pipeline building</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[#9FE870] mt-1">✓</span>
              <span>Step-by-step implementation guide - not just high-level theory</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[#9FE870] mt-1">✓</span>
              <span>Ready for your team to execute immediately</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-[#9FE870] mt-1">✓</span>
              <span>Yours to keep - no strings attached, whether you work with us or not</span>
            </p>
          </div>
          
          {/* Why We Do This */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-gray-300 text-sm">
              <span className="text-[#9FE870] font-semibold">Why give away such valuable insights for free?</span>
              <br />
              Because we practice what we preach - leading with value. Just as we'll help you do with your business, 
              we're demonstrating our expertise by actually helping you first. It's the best way to show you we know 
              what we're talking about.
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="space-y-4">
          <button 
            onClick={openModal}
            className="inline-block text-xl px-10 py-5 bg-[#9FE870] text-black rounded-md 
              hover:bg-[#8FD860] transition-colors duration-300 
              shadow-lg hover:shadow-xl font-bold"
          >
            Get Your Free Custom Paid Marketing Strategy
          </button>
          <p className="text-gray-200 text-sm">
            30-Minute Strategy Call - No Obligations
          </p>
        </div>
      </div>
    </section>
  );
} 