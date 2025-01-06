export function SolutionSection() {
  return (
    <section id="solution" className="section-padding bg-white">
      <div className="section-container">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
          Our AI-Powered Solution
        </h2>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Solution Description */}
          <div>
            <h3 className="text-3xl font-semibold mb-6 text-gray-900">
              Automate Your Way to Higher Sales
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3">
                <svg className="w-6 h-6 text-[#0066FF] mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">
                  Custom AI tools that handle repetitive tasks automatically
                </span>
              </li>
              <li className="flex items-start space-x-3">
                <svg className="w-6 h-6 text-[#0066FF] mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">
                  Smart lead qualification that prioritizes your best prospects
                </span>
              </li>
              <li className="flex items-start space-x-3">
                <svg className="w-6 h-6 text-[#0066FF] mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-lg text-gray-700">
                  Scalable systems that grow with your business
                </span>
              </li>
            </ul>
          </div>

          {/* CTA Card */}
          <div className="bg-gray-50 p-8 rounded-lg shadow-lg">
            <h3 className="text-2xl font-semibold mb-4 text-gray-900">
              Ready to Transform Your Sales Process?
            </h3>
            <p className="text-gray-700 mb-6">
              Book a free strategy call to see how our AI tools can be customized 
              for your specific needs.
            </p>
            <a 
              href="#book-call"
              className="inline-block text-lg px-6 py-3 bg-[#0A2E4D] text-white rounded-md 
                hover:bg-[#164875] transition-colors duration-300 
                shadow-lg hover:shadow-xl"
            >
              Schedule Your Call
            </a>
          </div>
        </div>
      </div>
    </section>
  );
} 