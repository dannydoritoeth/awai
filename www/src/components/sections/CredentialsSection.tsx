export function CredentialsSection() {
  return (
    <section className="section-padding bg-gray-50">
      <div className="section-container">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
          Proven Results
        </h2>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center">
            <div className="text-5xl font-bold text-[#0066FF] mb-2">300%</div>
            <p className="text-xl text-gray-700">Average Productivity Increase</p>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold text-[#0066FF] mb-2">60%</div>
            <p className="text-xl text-gray-700">Cost Reduction</p>
          </div>
          <div className="text-center">
            <div className="text-5xl font-bold text-[#0066FF] mb-2">2X</div>
            <p className="text-xl text-gray-700">Sales Growth</p>
          </div>
        </div>

        {/* Testimonial */}
        <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-lg">
          <div className="flex items-center mb-6">
            <img 
              src="/assets/testimonial-avatar.jpg" 
              alt="Client" 
              className="w-16 h-16 rounded-full mr-4"
            />
            <div>
              <h3 className="text-xl font-semibold">John Smith</h3>
              <p className="text-gray-600">Sales Director, Tech Solutions Inc</p>
            </div>
          </div>
          <blockquote className="text-lg text-gray-700 italic">
            "The AI system built by AccelerateWith.ai transformed our sales process. 
            We're now able to handle 3x the leads with the same team size, and our 
            conversion rates have never been better."
          </blockquote>
        </div>
      </div>
    </section>
  );
} 