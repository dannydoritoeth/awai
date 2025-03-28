'use client';

import { useBookingModal } from '@/contexts/BookingModalContext';

export function FAQSection() {
  const { openModal } = useBookingModal();
  
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="max-w-[1000px] mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">
            Common Questions From Agency Owners
          </h2>

          <div className="space-y-6">
            {/* FAQ Item */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">
                "How is this different from other lead generation services?"
              </h3>
              <p className="text-gray-700">
                Unlike others who charge upfront fees regardless of results, we only get paid when you 
                close deals. Our interests are completely aligned with yours - we succeed only when you do.
                You're getting <span className="font-bold">high-quality leads</span> that are ready to convert.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">
                "What kind of ROI can I expect?"
              </h3>
              <p className="text-gray-700">
                Our average partner sees a <span className="font-bold">326% increase in revenue</span> within 
                90 days. With our pay-for-performance model, your ROI is guaranteed - you only pay when 
                you close deals. Compare this to traditional marketing where you're paying 
                <span className="font-bold"> $10,000+ monthly</span> regardless of results.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">
                "How quickly can we get started?"
              </h3>
              <p className="text-gray-700">
                We can have your system up and running within <span className="font-bold">24 hours</span>. 
                Our streamlined onboarding process ensures you can start generating leads quickly and efficiently.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">
                "What's the catch?"
              </h3>
              <p className="text-gray-700">
                No catch. We're so confident in our system that we operate purely on 
                performance. You only pay when we deliver results. It's that simple - 
                our success is directly tied to yours.
              </p>
            </div>
          </div>

          {/* False Close */}
          <div className="mt-12 text-center">
            <p className="text-xl font-bold mb-4">
              Still on the fence?
            </p>
            <p className="text-gray-700 mb-8">
              Book a free strategy call to discuss your agency's growth potential.
              No pressure, no obligations - just a straightforward discussion about your goals.
            </p>
            <button 
              onClick={openModal}
              className="inline-block text-xl px-10 py-5 bg-[#0A2E4D] text-white rounded-md 
                hover:bg-[#164875] transition-colors duration-300 
                shadow-lg hover:shadow-xl"
            >
              Book Your Strategy Call
            </button>
          </div>
        </div>
      </div>
    </section>
  );
} 