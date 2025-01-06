export function NarrativeSection() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-[800px] mx-auto space-y-8">
          {/* Opening */}
          <div className="space-y-4">
            <p className="text-3xl font-bold">Dear Agency Leader,</p>
            <p>We get it.</p>
            <p>Growing a <span className="text-[#0066FF]">real estate agency</span> is hard. Really hard.</p>
          </div>

          {/* Current State */}
          <div className="space-y-4 text-gray-700">
            <p>Right now, like most agencies, your business probably comes from your sphere of influence - repeat business, referrals, and word of mouth.</p>
            <p>These are great sources, but they have two major problems:</p>
            <ul className="list-disc pl-8 space-y-2">
              <li>They're not scalable</li>
              <li>They're not predictable</li>
            </ul>
          </div>

          {/* Failed Solutions */}
          <div className="space-y-4">
            <p>So you've probably tried:</p>
            <div className="pl-6 space-y-2 text-gray-700 italic">
              <p>"Just buy more leads from portals!"</p>
              <p>"Try automated social media tools!"</p>
              <p>"Use this generic content service!"</p>
              <p>"Run templated Facebook ads!"</p>
            </div>
            <p className="font-bold">Sound familiar?</p>
            <p>But here's the problem - these solutions are either:</p>
            <ul className="list-disc pl-8 space-y-2 text-gray-700">
              <li>Delivering low-quality, unqualified leads</li>
              <li>Costing more than they generate</li>
              <li>Creating zero brand differentiation</li>
            </ul>
          </div>

          {/* The Real Issue */}
          <div className="space-y-4">
            <p className="text-[#0066FF] font-semibold">Here's what's really happening:</p>
            <p className="text-2xl font-bold">You don't need more marketing. You need the right system.</p>
            <p>
              One that builds real relationships and establishes you as the trusted authority in your market.
            </p>
          </div>

          {/* The Solution */}
          <div className="space-y-4">
            <p>Imagine having:</p>
            <ul className="list-disc pl-8 space-y-2 text-gray-700">
              <li>A predictable flow of qualified leads</li>
              <li>Territory exclusivity protection</li>
              <li>A system that builds your brand while generating leads</li>
            </ul>
          </div>

          {/* Value Prop */}
          <div className="space-y-4">
            <p className="text-2xl">The best part?</p>
            <p className="text-2xl font-semibold">You only pay when we deliver results.</p>
            <p>No retainers. No monthly fees. No risk.</p>
          </div>

          {/* Call to Action */}
          <div className="space-y-4">
            <p>Ready to build a predictable, scalable lead generation system?</p>
            <p>Book your strategy call to learn how we can help you dominate your market.</p>
          </div>
        </div>
      </div>
    </section>
  );
} 