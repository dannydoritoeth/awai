'use client';

import { useEffect } from 'react';

export function CTASection() {
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
    <section id="book-call" className="section-padding bg-[#0A2E4D] text-white">
      <div className="section-container">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Transform Your Sales Process?
          </h2>
          
          <p className="text-xl mb-8 text-gray-200">
            Book your free strategy call today and discover how our AI solutions 
            can help your team earn more while working less.
          </p>

          {/* Calendly Embed */}
          <div 
            className="calendly-inline-widget bg-white rounded-lg shadow-xl" 
            data-url="https://calendly.com/scott-acceleratewith/30min"
            style={{ 
              minWidth: '320px',
              height: '700px',
              width: '100%',
            }} 
          />

          {/* Alternative Contact */}
          <p className="mt-6 text-gray-300">
            Can't find a suitable time? Email{' '}
            <a 
              href="mailto:scott@acceleratewith.ai" 
              className="text-[#0066FF] hover:underline"
            >
              scott@acceleratewith.ai
            </a>
            {' '}to arrange a meeting.
          </p>

          {/* Urgency Note */}
          <p className="mt-8 text-lg text-gray-200 italic">
            * Limited spots available - book now to secure your consultation
          </p>
        </div>
      </div>
    </section>
  );
} 