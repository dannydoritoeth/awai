'use client';

import { useBookingModal } from '@/contexts/BookingModalContext';

export function OfferingSection() {
  const { openModal } = useBookingModal();

  return (
    <section className="py-16 bg-[#1A1A1A] text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-[1100px] mx-auto">
          {/* Main Heading */}
          <div className="mb-16 text-center">
            <h2 className="text-[#9FE870] text-xl mb-4">
              THE SYSTEM THAT DELIVERS:
            </h2>
            <h3 className="text-4xl md:text-6xl font-bold mb-6">
              GUARANTEED RESULTS
            </h3>
            <p className="text-gray-300 text-xl max-w-[800px] mx-auto">
              A done-for-you lead generation and automation system designed to help real estate agencies scale efficiently.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Offering 1 */}
            <div className="space-y-4">
              <div className="text-[#9FE870] mb-6">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold">
                Exclusive Territory Rights
              </h3>
              <p className="text-gray-300 text-lg">
                Lock out your competition with exclusive leads in your protected territory.
              </p>
              <ul className="text-gray-400 space-y-2 pl-4">
                <li>• Pre-qualified prospects</li>
                <li>• Exclusive to your agency</li>
                <li>• Territory protection</li>
              </ul>
            </div>

            {/* Offering 2 */}
            <div className="space-y-4">
              <div className="text-[#9FE870] mb-6">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold">
                Risk-Free Performance Model
              </h3>
              <p className="text-gray-300 text-lg">
                Only pay when deals close. No upfront costs or monthly fees.
              </p>
              <ul className="text-gray-400 space-y-2 pl-4">
                <li>• No retainers or setup fees</li>
                <li>• Pay only for results</li>
                <li>• Performance guarantee</li>
              </ul>
            </div>

            {/* Offering 3 */}
            <div className="space-y-4">
              <div className="text-[#9FE870] mb-6">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold">
                Done-For-You Automation
              </h3>
              <p className="text-gray-300 text-lg">
                Streamline your lead nurturing with automated systems.
              </p>
              <ul className="text-gray-400 space-y-2 pl-4">
                <li>• Automated follow-up sequences</li>
                <li>• Smart lead qualification</li>
                <li>• ROI tracking dashboard</li>
              </ul>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 text-center">
            <p className="text-[#9FE870] text-xl mb-4">
              Limited Time Offer
            </p>
            <p className="text-2xl font-bold mb-8">
              Lock In Your Territory Before Your Competition Does
            </p>
            <button 
              onClick={openModal}
              className="inline-block text-xl px-10 py-5 bg-[#9FE870] text-black rounded-md 
                hover:bg-[#8FD860] transition-colors duration-300 
                shadow-lg hover:shadow-xl font-bold"
            >
              Check Territory Availability Now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
} 