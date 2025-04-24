'use client';

import { Header } from '@/components/layout/Header';

export default function PartnerPage() {
  return (
    <div className="min-h-screen bg-[#1B2A47]">
      <Header />
      <main className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              🤝 ScoreAI Partner Program
            </h1>
            <p className="text-xl text-gray-300">
              Earn up to 40% monthly commissions by helping teams work smarter with AI-powered lead scoring.
            </p>
          </div>

          {/* Why Join Section */}
          <div className="bg-white/10 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">
              Why Join the ScoreAI Partner Program?
            </h2>
            <p className="text-gray-300 mb-4">
              ScoreAI helps businesses prioritize the leads most likely to convert — using AI trained on their real customer data.
            </p>
            <p className="text-gray-300">
              If you're an agency, consultant, creator, or community builder in the sales, marketing, CRM, or RevOps space, this is your chance to add value and earn recurring revenue.
            </p>
          </div>

          {/* How It Works Section */}
          <div className="bg-white/10 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                'You get a unique partner referral link',
                'Share it with your clients, followers, newsletter, or network',
                'When someone signs up and upgrades, you earn up to 40% commission every month they stay subscribed',
                'You can track all of it in your personal partner dashboard'
              ].map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="bg-[#0066FF] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-gray-300">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* What You'll Earn Section */}
          <div className="bg-white/10 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">What You'll Earn</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[
                '💰 40% recurring commission on every paying customer',
                '📆 Commissions last as long as the customer is active',
                '🚀 Monthly payouts, no thresholds',
                '🎁 Free access to ScoreAI for all active partners'
              ].map((benefit, index) => (
                <div key={index} className="text-gray-300">
                  {benefit}
                </div>
              ))}
            </div>
            
            <div className="bg-white/5 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4">Example:</h3>
              <ul className="text-gray-300 space-y-2">
                <li>Refer a Pro customer ($249/mo) → Earn $99.60/mo</li>
                <li>Refer 10 Growth users → Earn $1,996/mo</li>
              </ul>
            </div>
          </div>

          {/* Who Is This For Section */}
          <div className="bg-white/10 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Who Is This For?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                'HubSpot Partners & Agencies',
                'RevOps, Sales, and GTM Consultants',
                'SaaS content creators, influencers & communities',
                'Crypto-native builders looking for aligned utility',
                'Anyone with an audience of decision-makers using HubSpot'
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-[#0066FF]">✅</span>
                  <span className="text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Why ScoreAI Converts Section */}
          <div className="bg-white/10 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Why ScoreAI Converts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                'Works with all HubSpot tiers (even Free)',
                'No-code setup, install-and-go',
                'Free plan available to test',
                'Solves a painful, clear problem (lead prioritization)',
                'Scores across Contacts, Companies, and Deals'
              ].map((feature, index) => (
                <div key={index} className="text-gray-300">
                  • {feature}
                </div>
              ))}
            </div>
          </div>

          {/* How to Get Started Section */}
          <div className="bg-white/10 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">How to Get Started</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[
                'Apply to join the program',
                'Get access to your unique referral link & dashboard',
                'Share it via content, demos, DMs, or conversations',
                'Get paid every month'
              ].map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="bg-[#0066FF] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-gray-300">{step}</span>
                </div>
              ))}
            </div>

            <div className="text-center">
              <a
                href="/apply"
                className="inline-block bg-[#0066FF] text-white px-8 py-4 rounded-lg font-semibold hover:bg-[#0052CC] transition-colors"
              >
                Apply to Join the Partner Program
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 