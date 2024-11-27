'use client';

import { useEffect } from 'react';
import { ContactHeader } from '@/components/layout/ContactHeader';

export default function ContactPage() {
  useEffect(() => {
    // Load Calendly widget script
    const script = document.createElement('script');
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup script when component unmounts
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <>
      <ContactHeader />
      <main className="pt-40 pb-16 min-h-screen bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Target Audience Line */}
          <p className="text-center text-gray-600 mb-4">
            For Business Owners Who Want to Save Time and Money Using AI
          </p>

          {/* Main Call to Action */}
          <h1 className="text-center text-4xl md:text-5xl font-bold mb-6 text-gray-900 tracking-tight">
            LET US BUILD YOU A{' '}
            <br />
            <span className="text-[#0066FF]">READY-TO-USE</span>
            <br />
            AI SYSTEM FOR YOUR BUSINESS
          </h1>

          {/* Value Proposition */}
          <p className="text-center text-xl text-gray-700">
            Book a free call to see how our{' '}
            <span className="font-semibold">AI Tools</span>
            {' '}can help your business work faster and save money
          </p>

          {/* Calendly Widget */}
          <div className="calendly-inline-widget" 
            data-url="https://calendly.com/scottb1978/30min"
            style={{ 
              minWidth: '320px',
              height: '800px',
              width: '100%',
            }} 
          />
        </div>
      </main>
    </>
  );
} 