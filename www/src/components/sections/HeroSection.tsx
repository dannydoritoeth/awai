'use client';

import { useEffect, useState } from 'react';
import { useBookingModal } from '@/contexts/BookingModalContext';

export function HeroSection() {
  const { openModal } = useBookingModal();
  const [scale, setScale] = useState(1);
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const maxScroll = 500;
      const minScale = 0.7;
      
      if (scrollPosition <= maxScroll) {
        const newScale = 1 - (scrollPosition / maxScroll) * (1 - minScale);
        setScale(Math.max(minScale, newScale));
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return (
    <section className="relative min-h-screen">
      {/* Video Background */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <video 
          autoPlay 
          muted 
          loop 
          playsInline
          className="object-cover w-full h-full brightness-50 transition-transform duration-100"
          style={{ 
            transform: `scale(${scale})`,
            transformOrigin: 'center center' 
          }}
        >
          <source src="/assets/videos/11958600_3840_2160_30fps.mp4" type="video/mp4" />
        </video>
        {/* Darker overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-75" />
      </div>

      {/* Content */}
      <div className="relative container mx-auto px-4 text-center pt-32">
        {/* Eyebrow - Target Industry */}
        <p className="text-[#1A90FF] font-semibold text-lg md:text-xl mb-8">
          Real Estate Agencies: Scale Your Business Risk-Free
        </p>

        {/* Main Headline */}
        <h1 className="text-[4rem] md:text-[7rem] leading-[1] font-bold mb-6 text-white max-w-[1200px] mx-auto tracking-tight drop-shadow-lg">
          EXPLODE YOUR{' '}
          <br />
          SALES PIPELINE
        </h1>

        {/* Subheadline */}
        <p className="text-gray-100 text-lg md:text-xl mb-8 max-w-[800px] mx-auto">
          Our success is tied directly to yours. With our performance-based model, you only pay when deals close.
        </p>

        {/* Value Prop for Strategy Call */}
        <div className="bg-white/10 backdrop-blur-sm p-8 rounded-lg mb-8 max-w-[800px] mx-auto">
          <h3 className="text-[#9FE870] text-xl font-bold mb-4">
            Book Your Strategy Call and Get a Free Custom Marketing Plan
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
        </div>

        {/* CTA Button */}
        <div className="space-y-4">
          <button 
            onClick={openModal}
            className="inline-block text-xl px-10 py-5 bg-[#9FE870] text-black rounded-md 
              hover:bg-[#8FD860] transition-colors duration-300 
              shadow-lg hover:shadow-xl font-bold"
          >
            Get Your Free Marketing Strategy
          </button>
          <p className="text-gray-200 text-sm">
            30-Minute Strategy Call - No Obligations
          </p>
        </div>
      </div>
    </section>
  );
} 