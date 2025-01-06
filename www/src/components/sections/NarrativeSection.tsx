export function NarrativeSection() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="max-w-[800px] mx-auto space-y-8 text-xl">
          {/* Opening */}
          <p>Dear Agency Leader,</p>

          <p>We get it.</p>

          <p>Growing a <span className="text-[#0066FF]">real estate agency</span> is hard. Really hard.</p>

          <p>While other agencies waste <span className="text-[#0066FF]">$10,000+ monthly on leads</span> that go nowhere...</p>

          {/* Pain Points */}
          <div className="space-y-4 text-gray-700">
            <p>You're watching <span className="font-bold">67% of your ad spend</span> burn on tire-kickers and time-wasters.</p>
            <p>Your team is wasting <span className="font-bold">20+ hours per week</span> chasing dead-end leads.</p>
            <p>And your competitors? They're snatching up the best listings in your area.</p>
            <p className="italic">But here's what really keeps you up at night...</p>
          </div>

          {/* Common Advice */}
          <div className="space-y-4">
            <p>Everyone's giving you the same useless advice:</p>
            <div className="pl-6 space-y-2 text-gray-700 italic">
              <p>"Just spend more on Facebook ads!"</p>
              <p>"Have you tried cold calling?"</p>
              <p>"Maybe start a YouTube channel?"</p>
              <p>"Drop another $15k on Google Ads this month!"</p>
            </div>
            <p className="font-bold">Sound familiar?</p>
            <p>It's not just exhausting. It's expensive.</p>
          </div>

          {/* Truth */}
          <p className="text-gray-700">
            The truth? Most agencies are hemorrhaging money chasing outdated marketing strategies that stopped working years ago.
          </p>

          {/* Hope */}
          <div className="space-y-4">
            <p className="text-[#0066FF] font-semibold">But here's the game-changing news:</p>
            <p className="text-2xl font-bold">You don't need more marketing. You need the right system.</p>
            <p>
              A proven system that delivers <span className="font-bold">50+ exclusive leads monthly</span>, with a 
              <span className="font-bold"> 78% conversion rate</span> to closed deals.
            </p>
          </div>

          {/* Vision */}
          <div className="space-y-4">
            <p>Imagine next month:</p>
            <ul className="list-disc pl-8 space-y-2 text-gray-700">
              <li>Your pipeline filled with <span className="font-bold">pre-qualified, ready-to-list leads</span></li>
              <li>Your team focused on <span className="font-bold">closing deals</span>, not chasing them</li>
              <li>Your revenue growing while your marketing costs <span className="font-bold">drop by 40%</span></li>
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
            <p className="text-red-600 font-bold">But you need to act fast.</p>
            <p>We only work with one agency per territory, and your area is still available... for now.</p>
            <p>Choose your path: Keep burning money on outdated marketing, or claim your territory below and start dominating your market.</p>
          </div>
        </div>
      </div>
    </section>
  );
} 