'use client';

import { useEffect, useState } from 'react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    Calendly: any;
  }
}

export function BookingModal({ isOpen, onClose }: BookingModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const CALENDLY_URL = "https://calendly.com/scott-acceleratewith/30min";

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Load Calendly script
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-lg w-full max-w-4xl">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Modal Content */}
          <div className="p-8">
            <h2 className="text-2xl font-bold mb-4 text-center">
              Book Your Free Strategy Call
            </h2>
            
            {/* Loading State */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
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
      </div>
    </div>
  );
} 