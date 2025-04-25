'use client';

import { Header } from '@/components/layout/Header';

const plans = [
  {
    name: 'Free',
    price: '0',
    description: 'For small teams just getting started',
    features: [
      '<b>Manually</b> score up to <b>50 records/month</b>',
      'Works with Contacts, Companies, and Deals',
      'View scores directly in HubSpot',
      'Setup guide and email support'
    ],
    cta: 'Get Started Free',
    ctaLink: '/signup',
    highlight: false
  },
  {
    name: 'Starter',
    price: '99',
    description: 'For solo operators and early teams',
    features: [
      'Everything in Free plus',
      '<b>Automatically</b> score up to <b>750 records/month</b> (~25/day)'
    ],
    cta: 'Start with Starter',
    ctaLink: '/signup?plan=starter',
    highlight: false
  },
  {
    name: 'Pro',
    price: '249',
    description: 'For small sales & marketing teams',
    features: [
      'Everything in Free plus',
      '<b>Automatically</b> score up to <b>3,000 records/month</b> (~100/day)'
    ],
    cta: 'Upgrade to Pro',
    ctaLink: '/signup?plan=pro',
    highlight: true
  },
  {
    name: 'Growth',
    price: '499',
    description: 'For mid-sized orgs or scaled outbound teams',
    features: [
      'Everything in Free plus',
      '<b>Automatically</b> score up to <b>7,500 records/month</b> (~250/day)'
    ],
    cta: 'Choose Growth Plan',
    ctaLink: '/signup?plan=growth',
    highlight: false
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large organizations or agency partnerships',
    features: [
      'Unlimited record scoring',
      'Custom AI logic or integrations available',
      'Dedicated success manager',
      'Slack & Zoom support',
      'White-labeled deployments for partners'
    ],
    cta: 'Contact Sales',
    ctaLink: '/contact',
    highlight: false
  }
];

const commonFeatures = [
  'AI scoring trained on your real customer data',
  'Works across Contacts, Companies & Deals',
  'Works with all HubSpot plans',
  'Seamless HubSpot integration',
  'Scores update automatically as CRM changes',
  'No manual workflows needed'
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#1B2A47]">
      <Header />
      <main className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          {/* Header Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              ScoreAI Pricing Plans
            </h1>
            <p className="text-xl text-gray-300 mb-4">
              Powerful AI Lead Scoring for HubSpot Teams of Any Size
            </p>
            <p className="text-gray-400">
              Get started for free. Upgrade as you grow.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8 mb-16">
            {plans.map((plan) => (
              <div 
                key={plan.name}
                className={`bg-white rounded-lg p-6 flex flex-col ${
                  plan.highlight ? 'ring-2 ring-[#0066FF] shadow-lg' : ''
                }`}
              >
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline mb-4">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    {plan.price !== 'Custom' && <span className="text-gray-600 ml-2">/month</span>}
                  </div>
                  <p className="text-gray-600 text-sm">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8 flex-grow">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-green-500 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span 
                        className="text-gray-700"
                        dangerouslySetInnerHTML={{ __html: feature }}
                      />
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.ctaLink}
                  className={`w-full py-3 px-4 rounded-md text-center font-semibold transition-colors ${
                    plan.highlight
                      ? 'bg-[#0066FF] text-white hover:bg-[#0052CC]'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          {/* Common Features Section */}
          <div className="bg-white/10 rounded-lg p-8 mb-16">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              All plans include:
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {commonFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-[#0066FF] mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span 
                    className="text-gray-300"
                    dangerouslySetInnerHTML={{ __html: feature }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Start for free and discover which leads matter most.
            </h2>
            <p className="text-gray-400">
              No credit card required.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
} 