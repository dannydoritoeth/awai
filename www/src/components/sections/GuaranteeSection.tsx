'use client';

import { useBookingModal } from '@/contexts/BookingModalContext';

export function GuaranteeSection() {
  const { openModal } = useBookingModal();
  
  return (
    <section className="py-16 bg-[#0A2E4D] text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left Side - Main Guarantee */}
            <div className="space-y-8">
              <h2 className="text-4xl md:text-5xl font-bold">
                Our "No BS" Triple Guarantee
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="text-[#9FE870] mt-1">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Performance Guarantee</h3>
                    <p className="text-gray-300">
                      We only succeed when you succeed. No upfront costs, just results-based pricing.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="text-[#9FE870] mt-1">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Pay Only For Results</h3>
                    <p className="text-gray-300">
                      No monthly retainers. No setup fees. You only pay when we deliver closed deals.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Value Stack */}
            <div className="bg-white text-gray-900 p-8 rounded-lg shadow-xl">
              <div className="space-y-6">
                <h3 className="text-2xl font-bold">What You Get:</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span>Lead Generation System</span>
                    <span className="text-gray-500">$5,000/mo value</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span>Automation Suite</span>
                    <span className="text-gray-500">$3,500/mo value</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span>Performance Analytics</span>
                    <span className="text-gray-500">$2,500/mo value</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                    <span>Strategy Consultation</span>
                    <span className="text-gray-500">$1,000 value</span>
                  </div>
                </div>

                <div className="pt-4">
                  <div className="flex items-center justify-between text-xl font-bold">
                    <span>Total Value:</span>
                    <span>$12,000/mo</span>
                  </div>
                  <div className="flex items-center justify-between text-lg text-[#0066FF] font-bold mt-2">
                    <span>Your Investment:</span>
                    <span>Pay Per Result</span>
                  </div>
                </div>

                <button 
                  onClick={openModal}
                  className="block text-center text-lg px-8 py-4 bg-[#0A2E4D] text-white rounded-md 
                    hover:bg-[#164875] transition-colors duration-300 
                    shadow-lg hover:shadow-xl mt-6"
                >
                  Book Your Strategy Call
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 