export function SolutionSection() {
  return (
    <section id="solution" className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          EXPLODE YOUR SALES PIPELINE
        </h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-[1100px] mx-auto">
          {/* Solution 1 */}
          <div className="bg-gray-50 p-8 rounded-lg shadow-lg">
            <div className="text-[#0066FF] mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">
              Exclusive High-Intent Leads
            </h3>
            <p className="text-gray-700">
              Get access to qualified, exclusive leads that are ready to convert, giving you a competitive edge in your market.
            </p>
          </div>

          {/* Solution 2 */}
          <div className="bg-gray-50 p-8 rounded-lg shadow-lg">
            <div className="text-[#0066FF] mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">
              Pay-For-Performance Pricing
            </h3>
            <p className="text-gray-700">
              Only pay when you close deals. No upfront costs, no monthly fees - align our success with yours.
            </p>
          </div>

          {/* Solution 3 */}
          <div className="bg-gray-50 p-8 rounded-lg shadow-lg">
            <div className="text-[#0066FF] mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">
              Scalable Automation Tools
            </h3>
            <p className="text-gray-700">
              Handle increased lead volume effortlessly with our automated systems that grow with your business.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
} 