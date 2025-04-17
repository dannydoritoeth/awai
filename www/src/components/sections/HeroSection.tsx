'use client';

import { useBookingModal } from '@/contexts/BookingModalContext';

export function HeroSection() {
  const { openModal } = useBookingModal();
  
  return (
    <section className="bg-[#1B2A47] min-h-screen pt-20">
      {/* Hero Content */}
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl text-white mb-2">HUBSPOT SALES PROFESSIONALS</h2>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Close More HubSpot Deals<br />
          with AI-Based Lead Scoring
        </h1>
        <p className="text-gray-300 text-lg mb-8">
          Stop Wasting Time on Low-Quality Leads. No Complex Setup. No Long-Term Contracts. No Wasted Effort.
        </p>
        <button onClick={openModal} className="bg-[#3B82F6] text-white px-8 py-3 rounded-md font-semibold hover:bg-[#2563EB] transition">
          GET A FREE AUDIT
        </button>
      </div>

      {/* Problem Statement Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="bg-white rounded-lg p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="md:w-1/2">
            <img 
              src="/assets/meeting-image.jpg" 
              alt="Team meeting" 
              className="rounded-lg"
            />
          </div>
          <div className="md:w-1/2">
            <h2 className="text-2xl font-bold mb-4">Struggling to Close Deals?<br />Here's Why.</h2>
            <ul className="space-y-4">
              <li className="flex items-start gap-2">
                <span className="text-red-500">🔴</span>
                <span><strong>Too Many Unqualified Leads</strong> → You're spending time chasing low-value leads that never convert.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">🔴</span>
                <span><strong>No Clear Way to Prioritize Leads</strong> → Your sales team is working blind — you don't know which leads are actually ready to buy.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">🔴</span>
                <span><strong>Lost Revenue from Poor Follow-Up</strong> → High-quality leads slip through the cracks without proper scoring and automation.</span>
              </li>
            </ul>
            <button onClick={openModal} className="bg-[#3B82F6] text-white px-8 py-3 rounded-md font-semibold mt-8 hover:bg-[#2563EB] transition">
              GET A FREE AUDIT
            </button>
          </div>
        </div>
      </div>

      {/* How We Can Help Section */}
      <div className="container mx-auto px-4 py-16 text-white">
        <h2 className="text-3xl font-bold text-center mb-6">How We Can Help</h2>
        <p className="text-center text-xl mb-12">
          We provide a completely done-for-you AI-based lead scoring system to help you increase your close rate in three simple steps:
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-[#243456] p-6 rounded-lg">
            <div className="text-2xl font-bold mb-4">1</div>
            <h3 className="font-bold text-xl mb-4">Smart Lead Targeting</h3>
            <p className="mb-4 text-gray-300">AI analyzes your HubSpot data to uncover your most valuable leads.</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>No more wasting time on unqualified leads.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>Focus only on leads that match your ideal customer profile.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>Our AI scoring model adjusts dynamically based on performance data.</span>
              </li>
            </ul>
          </div>
          <div className="bg-[#243456] p-6 rounded-lg">
            <div className="text-2xl font-bold mb-4">2</div>
            <h3 className="font-bold text-xl mb-4">AI-Based Lead Scoring & Prioritization</h3>
            <p className="mb-4 text-gray-300">AI scores every lead in real-time based on behavior, engagement, and historical data.</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>High-value leads are prioritized for immediate follow-up.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>Low-value leads are routed into a nurture sequence.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>Sales team knows exactly where to focus — no more guesswork.</span>
              </li>
            </ul>
          </div>
          <div className="bg-[#243456] p-6 rounded-lg">
            <div className="text-2xl font-bold mb-4">3</div>
            <h3 className="font-bold text-xl mb-4">Seamless HubSpot Integration & Automated Follow-Up</h3>
            <p className="mb-4 text-gray-300">We integrate directly with HubSpot to automate follow-up and lead qualification.</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>High-scoring leads are sent to your sales team for immediate outreach.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>AI-driven workflows ensure fast response times.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>Long-term leads are nurtured automatically in the background.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Why AI Lead Scoring Works */}
      <div className="container mx-auto px-4 py-16 text-white">
        <h2 className="text-3xl font-bold text-center mb-8">Why AI Lead Scoring Works</h2>
        <p className="text-center text-xl mb-8">AI-based lead scoring is already transforming sales teams:</p>
        <div className="bg-[#243456] p-8 rounded-lg">
          <ul className="space-y-4">
            <li className="flex items-start gap-2">
              <span className="text-green-500">✅</span>
              <span>Companies using AI lead scoring report up to 20% higher conversion rates.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✅</span>
              <span>AI reduces time spent on low-quality leads by up to 85% — letting your team focus on closing deals.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✅</span>
              <span>Businesses using AI for lead prioritization see a 13%–31% drop in churn rates.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="bg-white rounded-lg p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="md:w-1/2">
            <h2 className="text-2xl font-bold mb-4">"This Sounds Complicated..."<br />Here's Why It's Not.</h2>
            <p className="mb-6">We get it — most sales optimization tools are complex, expensive, and hard to implement.</p>
            <ul className="space-y-4 mb-6">
              <li className="flex items-start gap-2">
                <span className="text-red-500">❌</span>
                <span>Complicated setup that takes months to configure</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">❌</span>
                <span>Locked into long-term contracts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500">❌</span>
                <span>High costs with no guaranteed results</span>
              </li>
            </ul>
            <p className="font-bold mb-4">That's NOT how we work.</p>
            <ul className="space-y-4 mb-6">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>We handle the setup — you focus on closing deals.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>It integrates directly with HubSpot in minutes.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>We only succeed when you succeed — our incentives are aligned.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✅</span>
                <span>You're in full control — cancel anytime, no risk.</span>
              </li>
            </ul>
            <p className="mb-6">If you're ready to stop wasting time on cold leads and want a smarter way to close more deals, let's talk.</p>
            <button onClick={openModal} className="bg-[#3B82F6] text-white px-8 py-3 rounded-md font-semibold hover:bg-[#2563EB] transition">
              GET A FREE AUDIT
            </button>
          </div>
          <div className="md:w-1/2">
            <img 
              src="/assets/team-working.jpg" 
              alt="Team working" 
              className="rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* FAQs Section */}
      <div className="container mx-auto px-4 py-16 text-white">
        <h2 className="text-3xl font-bold text-center mb-8">FAQs</h2>
        <div className="bg-[#243456] p-8 rounded-lg space-y-8">
          <div>
            <h3 className="font-bold mb-2">How does it integrate with HubSpot?</h3>
            <p>Our system connects directly to HubSpot using secure OAuth access. You can authorize the connection in a few clicks — no coding required.</p>
          </div>
          
          <div>
            <h3 className="font-bold mb-2">How long does it take to see results?</h3>
            <p>Most clients see an increase in close rates within 30 days. Our AI model adapts to your data over time, improving accuracy the longer it runs.</p>
          </div>
          
          <div>
            <h3 className="font-bold mb-2">How does the AI model score leads?</h3>
            <p>The AI analyzes:<br />
            - Engagement (emails opened, links clicked, calls)<br />
            - Deal history and close rates<br />
            - Lead demographics and source<br />
            - Behavioral signals (website visits, responses).<br /><br />
            High-scoring leads are prioritized for immediate follow-up.</p>
          </div>
          
          <div>
            <h3 className="font-bold mb-2">Do I need to change my existing HubSpot workflows?</h3>
            <p>No — our system works with your existing HubSpot setup. You can create new automation rules or simply adjust your lead prioritization based on the AI scores.</p>
          </div>
          
          <div>
            <h3 className="font-bold mb-2">Is my data secure?</h3>
            <p>Yes — we use industry-standard encryption and secure data handling practices. We only access the data needed to generate lead scores, and you can revoke access at any time.</p>
          </div>
          
          <div>
            <h3 className="font-bold mb-2">What happens if the AI scores a lead incorrectly?</h3>
            <p>AI scoring improves over time based on feedback and new data. You can also manually adjust lead scores or override recommendations at any time.</p>
          </div>
        </div>
      </div>
    </section>
  );
} 