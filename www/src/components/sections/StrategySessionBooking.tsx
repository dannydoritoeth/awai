'use client';

import { useEffect, useState } from 'react';

export function StrategySessionBooking() {
  const [isLoading, setIsLoading] = useState(true);
  const CALENDLY_URL = "https://calendly.com/scott-acceleratewith/30min";

  // Load Calendly script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = () => {
      setIsLoading(false);
    };
    document.body.appendChild(script);

    return () => {
      const existingScript = document.querySelector(`script[src="${script.src}"]`);
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <section className="container mx-auto px-4 pb-20">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-4 text-center">
              Get Your Free Custom Paid Marketing Strategy
            </h1>
            <div className="flex justify-center mb-6">
              <div className="bg-[#9FE870]/10 px-4 py-2 rounded-full border border-[#9FE870]/20">
                <span className="text-[#9FE870] font-bold">$2,500 Value - Yours Free</span>
              </div>
            </div>
            
            {/* Benefits List */}
            <div className="bg-gray-50 p-6 rounded-lg mb-6">
              <p className="text-gray-700 mb-4">
                After your free 30-minute strategy call we will go away and do some research and provide you with your custom paid marketing plan including:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-[#9FE870] mt-1">✓</span>
                  <span>Ideal client profile and pain point identification</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#9FE870] mt-1">✓</span>
                  <span>Detailed marketing strategy for both immediate wins and long-term pipeline building</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#9FE870] mt-1">✓</span>
                  <span>Step-by-step implementation guide - not just high-level theory</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#9FE870] mt-1">✓</span>
                  <span>90-day Action Plan with clear milestones and targets</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#9FE870] mt-1">✓</span>
                  <span>Ready for your team to execute immediately</span>
                </li>
              </ul>
              <p className="text-sm text-gray-500 mt-4 italic">
                Yours to keep - no strings attached, whether you work with us or not
              </p>

              {/* Why We Do This */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-gray-700 text-sm">
                  <span className="text-[#0A2E4D] font-semibold">Why give away such valuable insights for free?</span>
                  <br />
                  Because we practice what we preach - leading with value. We're demonstrating our expertise and building trust 
                  by actually helping you first. It's the best way to show you we know what we're talking about.
                </p>
              </div>
            </div>
          </div>
          
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0066FF]"></div>
            </div>
          )}

          {/* Calendly Inline Widget */}
          <div 
            className="calendly-inline-widget"
            data-url={`${CALENDLY_URL}?hide_gdpr_banner=1&background_color=ffffff&text_color=333333&primary_color=0066FF`}
            style={{ 
              minWidth: '320px',
              height: '700px' 
            }}
          />
        </div>
      </div>
    </section>
  );
} 