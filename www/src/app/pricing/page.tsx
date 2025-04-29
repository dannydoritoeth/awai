'use client';

import { Header } from '@/components/layout/Header';
import { useSearchParams } from 'next/navigation';
import { useState, useCallback, Suspense } from 'react';

const STRIPE_CHECKOUT_URL = 'https://gjhagcbedjcibzzzvbqp.supabase.co/functions/v1/hubspot-stripe-create-checkout-session';

type Plan = {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  highlight: boolean;
  planTier: string;
  ctaLink?: string;
  annualPrice?: string;
};

const plans: Plan[] = [
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
    highlight: false,
    planTier: 'free'
  },
  {
    name: 'Starter',
    price: '99',
    annualPrice: '79',
    description: 'For solo operators and early teams',
    features: [
      'Everything in Free plus',
      '<b>Automatically</b> score up to <b>750 records/month</b> (~25/day)'
    ],
    cta: 'Start with Starter',
    highlight: false,
    planTier: 'starter'
  },
  {
    name: 'Pro',
    price: '249',
    annualPrice: '199',
    description: 'For small sales & marketing teams',
    features: [
      'Everything in Free plus',
      '<b>Automatically</b> score up to <b>3,000 records/month</b> (~100/day)'
    ],
    cta: 'Upgrade to Pro',
    highlight: true,
    planTier: 'pro'
  },
  {
    name: 'Growth',
    price: '499',
    annualPrice: '399',
    description: 'For mid-sized orgs or scaled outbound teams',
    features: [
      'Everything in Free plus',
      '<b>Automatically</b> score up to <b>7,500 records/month</b> (~250/day)'
    ],
    cta: 'Choose Growth Plan',
    highlight: false,
    planTier: 'growth'
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
    highlight: false,
    planTier: 'enterprise'
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

function PricingContent() {
  const searchParams = useSearchParams();
  const portalId = searchParams.get('portal_id');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handlePlanClick = useCallback(async (plan: Plan & { interval?: 'month' | 'year' }) => {
    if (plan.ctaLink) {
      window.location.href = plan.ctaLink;
      return;
    }

    if (!portalId) {
      alert('No HubSpot Account detected. Please follow the instructions to link the payment to your HubSpot account.');
      return;
    }

    setIsLoading(plan.planTier);

    try {
      const response = await fetch(`${STRIPE_CHECKOUT_URL}?portal_id=${portalId}&plan_tier=${plan.planTier}&interval=${plan.interval || 'month'}`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      alert('There was an error creating your checkout session. Please try again.');
      console.error('Checkout error:', error);
    } finally {
      setIsLoading(null);
    }
  }, [portalId]);

  return (
    <>
      {/* Warning Panel */}
      {!portalId && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">HubSpot Account Required</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>To purchase a plan, you need to link your HubSpot account. Please follow these steps:</p>
                <ol className="list-decimal ml-4 mt-2">
                  <li>Follow the <a href="hubspot-setup" className="text-blue-500 hover:underline">Hubspot Setup Guide</a> to install & setup the ScoreAI app</li>
                  <li>Use the upgrade link on the ScoreAI card to return to this page to complete your purchase</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

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
            className={`bg-white rounded-lg p-6 ${
              plan.highlight ? 'ring-2 ring-[#0066FF] shadow-lg' : ''
            }`}
          >
            {/* Card Header - Fixed height */}
            <div className="h-[160px]">
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <div className="flex items-baseline mb-4">
                <span className="text-3xl font-bold">${plan.price}</span>
                {plan.price !== 'Custom' && <span className="text-gray-600 ml-2">/month</span>}
              </div>
              <p className="text-gray-600 text-sm">{plan.description}</p>
            </div>

            {/* Features List - Increased height */}
            <div className="h-[400px]">
              <ul className="space-y-4">
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
            </div>

            {/* Button Section - Increased height */}
            <div className="h-[140px]">
              <button
                onClick={() => handlePlanClick(plan)}
                disabled={isLoading === plan.planTier}
                className={`w-full py-3 px-4 rounded-md text-center font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-[#0066FF] text-white hover:bg-[#0052CC]'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                } ${isLoading === plan.planTier ? 'opacity-75 cursor-not-allowed' : ''}`}
              >
                {isLoading === plan.planTier ? 'Loading...' : plan.cta}
              </button>
              {plan.annualPrice && (
                <button
                  onClick={() => handlePlanClick({ ...plan, interval: 'year' })}
                  className="w-full mt-4 text-sm text-gray-500 hover:text-gray-700"
                >
                  or ${plan.annualPrice}/mo billed annually
                  <span className="text-green-600 ml-1 block mt-2">
                    (Save ${(Number(plan.price) - Number(plan.annualPrice)) * 12}/year)
                  </span>
                </button>
              )}
            </div>
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
    </>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#1B2A47]">
      <Header />
      <main className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          <Suspense fallback={
            <div className="text-center text-white">
              Loading pricing information...
            </div>
          }>
            <PricingContent />
          </Suspense>
        </div>
      </main>
    </div>
  );
} 