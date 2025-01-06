export function ProblemSection() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Tired of These Common Real Estate Challenges?
        </h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-[1100px] mx-auto">
          {/* Challenge 1 */}
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <div className="text-[#0066FF] mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">
              Costly Third-Party Platforms
            </h3>
            <p className="text-gray-700">
              Wasting thousands on expensive lead generation platforms with diminishing returns and increasing costs.
            </p>
          </div>

          {/* Challenge 2 */}
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <div className="text-[#0066FF] mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">
              Inconsistent Lead Quality
            </h3>
            <p className="text-gray-700">
              Dealing with low-quality leads that waste your team's time and rarely convert into actual deals.
            </p>
          </div>

          {/* Challenge 3 */}
          <div className="bg-white p-8 rounded-lg shadow-lg">
            <div className="text-[#0066FF] mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">
              Scalability Struggles
            </h3>
            <p className="text-gray-700">
              Unable to handle increased lead volume efficiently, leading to missed opportunities and operational bottlenecks.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
} 