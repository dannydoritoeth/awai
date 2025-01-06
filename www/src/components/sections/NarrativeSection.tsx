export function NarrativeSection() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-[800px] mx-auto space-y-8">
          {/* Problem */}
          <div>
            <h2 className="text-3xl font-bold mb-4">
              Dear Agency Leader,
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed">
              We get it. Running a real estate agency is challenging. You're constantly juggling lead generation, team management, and trying to scale your business - all while dealing with increasing competition and marketing costs.
            </p>
          </div>

          {/* Pain Points */}
          <div>
            <h3 className="text-2xl font-bold mb-4 text-[#0066FF]">
              The Traditional Approach Isn't Working
            </h3>
            <p className="text-gray-700 text-lg leading-relaxed">
              You've tried various marketing strategies - paid ads, cold calling, networking events. But these methods are either too expensive, too time-consuming, or simply don't deliver consistent results.
            </p>
          </div>

          {/* Solution */}
          <div>
            <h3 className="text-2xl font-bold mb-4 text-[#0066FF]">
              There's a Better Way
            </h3>
            <p className="text-gray-700 text-lg leading-relaxed">
              Imagine having a reliable system that consistently delivers qualified leads to your agency, without the usual risks and upfront costs. Our performance-based model means you only pay when you succeed.
            </p>
          </div>

          {/* Call to Action */}
          <div>
            <p className="text-gray-700 text-lg leading-relaxed">
              Ready to transform your agency's lead generation? Book your free strategy call today.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
} 