export function ProofSection() {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-[1100px] mx-auto">
          {/* Main Heading */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Real Results. Real Agencies.
            </h2>
            <p className="text-xl text-gray-600">
              Join these agencies who are already dominating their markets
            </p>
          </div>

          {/* Case Studies */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            {/* Case Study 1 */}
            <div className="bg-gray-50 p-8 rounded-lg">
              <div className="flex items-center mb-6">
                <img 
                  src="/assets/testimonial1.jpg" 
                  alt="Agency Logo" 
                  className="w-16 h-16 rounded-full mr-4"
                />
                <div>
                  <h3 className="text-xl font-bold">Ray White Double Bay</h3>
                  <p className="text-gray-600">Sydney, Australia</p>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-2xl font-bold text-[#0066FF]">
                  "78 New Listings in 90 Days"
                </p>
                <p className="text-gray-600">
                  "We were spending $15k/month on leads with mixed results. This system delivered 
                  78 exclusive listings in our first 90 days - all on performance basis."
                </p>
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-2xl font-bold">326%</p>
                    <p className="text-sm text-gray-600">Revenue Increase</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">$0</p>
                    <p className="text-sm text-gray-600">Upfront Cost</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Case Study 2 */}
            <div className="bg-gray-50 p-8 rounded-lg">
              <div className="flex items-center mb-6">
                <img 
                  src="/assets/testimonial2.jpg" 
                  alt="Agency Logo" 
                  className="w-16 h-16 rounded-full mr-4"
                />
                <div>
                  <h3 className="text-xl font-bold">McGrath Estate Agents</h3>
                  <p className="text-gray-600">Melbourne, Australia</p>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-2xl font-bold text-[#0066FF]">
                  "From 12 to 50+ Monthly Listings"
                </p>
                <p className="text-gray-600">
                  "The automated systems freed up our team to focus on closing deals instead of 
                  chasing leads. We're now doing 50+ listings monthly with the same team size."
                </p>
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-2xl font-bold">4X</p>
                    <p className="text-sm text-gray-600">Listing Volume</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">20hrs</p>
                    <p className="text-sm text-gray-600">Saved Weekly</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl font-bold text-[#0066FF]">100+</p>
              <p className="text-gray-600">Active Agencies</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-[#0066FF]">78%</p>
              <p className="text-gray-600">Conversion Rate</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-[#0066FF]">$0</p>
              <p className="text-gray-600">Upfront Cost</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-[#0066FF]">24hrs</p>
              <p className="text-gray-600">Setup Time</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 