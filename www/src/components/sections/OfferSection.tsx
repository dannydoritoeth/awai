export function OfferSection() {
  return (
    <section id="guarantee" className="section-padding bg-gray-50">
      <div className="section-container">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
          Our Guarantee
        </h2>

        {/* Main Offer Card */}
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-lg mb-12">
          <h3 className="text-3xl font-bold text-center mb-6 text-[#0066FF]">
            Results-Based Pricing
          </h3>
          
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <svg className="w-6 h-6 text-green-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-lg text-gray-700">
                <span className="font-semibold">No Upfront Costs:</span> You only pay when you see measurable results
              </p>
            </div>
            
            <div className="flex items-start space-x-4">
              <svg className="w-6 h-6 text-green-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-lg text-gray-700">
                <span className="font-semibold">90-Day Guarantee:</span> If you don't see improvement in your sales process, we'll work with you for free until you do
              </p>
            </div>
            
            <div className="flex items-start space-x-4">
              <svg className="w-6 h-6 text-green-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-lg text-gray-700">
                <span className="font-semibold">Dedicated Support:</span> Direct access to our AI experts throughout implementation
              </p>
            </div>
          </div>
        </div>

        {/* Value Stack */}
        <div className="text-center">
          <p className="text-2xl font-semibold mb-4">Total Value: $20,000+</p>
          <p className="text-xl text-gray-700">
            But you only pay for results - starting at just 10% of increased revenue
          </p>
        </div>
      </div>
    </section>
  );
} 