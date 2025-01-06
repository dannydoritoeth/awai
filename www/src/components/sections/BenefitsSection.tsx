export function BenefitsSection() {
  return (
    <section id="benefits" className="section-padding bg-white">
      <div className="section-container">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
          Why Choose Our AI Solution?
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Benefit 1 */}
          <div className="p-6">
            <div className="text-[#0066FF] mb-4">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M13 10V3L4 14h7v7l9-11h-7z" 
                />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-3">Rapid Implementation</h3>
            <p className="text-gray-700">
              Get up and running in days, not months. Our systems integrate 
              seamlessly with your existing workflow.
            </p>
          </div>

          {/* Benefit 2 */}
          <div className="p-6">
            <div className="text-[#0066FF] mb-4">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-3">Cost Effective</h3>
            <p className="text-gray-700">
              Pay only for results. No large upfront costs or lengthy 
              commitments required.
            </p>
          </div>

          {/* Benefit 3 */}
          <div className="p-6">
            <div className="text-[#0066FF] mb-4">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold mb-3">Proven Security</h3>
            <p className="text-gray-700">
              Enterprise-grade security ensures your data stays protected 
              while leveraging cutting-edge AI.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
} 