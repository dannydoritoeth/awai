'use client';

import { Header } from '@/components/layout/Header';
import Link from 'next/link';

export default function HubSpotSetupPage() {
  return (
    <div className="min-h-screen bg-[#1B2A47]">
      <Header />
      <main className="pt-32 pb-16">
        <div className="container mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Getting Started with ScoreAI on HubSpot
            </h1>
          </div>

          {/* What Is ScoreAI Section */}
          <div className="bg-white/10 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">
              💡 What Is ScoreAI?
            </h2>
            <p className="text-gray-300 mb-6">
              ScoreAI helps you prioritize your pipeline by automatically scoring your Deals using AI trained on your real HubSpot data.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                'Scores range from 0–100 based on similarity to past high-converting deals',
                'Trained automatically from Closed Won and Closed Lost deals — no manual setup required',
                'Works with any HubSpot plan, including Free',
                'View scores and insights directly inside the Deal record'
              ].map((feature, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-[#0066FF]">•</span>
                  <span className="text-gray-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* How to Set It Up Section */}
          <div className="bg-white/10 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">
              🚀 How to Set It Up
            </h2>
            
            {/* Step 1 */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-4">
                Step 1: Install ScoreAI
              </h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">1.</span>
                  Visit the HubSpot App Marketplace
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">2.</span>
                  Search for "ScoreAI"
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">3.</span>
                  Click Install App and connect it to your HubSpot portal
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">4.</span>
                  Approve requested permissions when prompted
                </li>
              </ul>
            </div>

            {/* Step 2 */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-4">
                Step 2: Let ScoreAI Train Automatically
              </h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">•</span>
                  After install, ScoreAI looks at your recent Deals (Closed Won & Closed Lost)
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">•</span>
                  It identifies patterns in deal size, stage progression, time to close, and other factors
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">•</span>
                  No tagging or manual scoring needed — the system trains itself using your real pipeline history
                </li>
              </ul>
            </div>

            {/* Step 3 */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-4">
                Step 3: View Deal Scores in HubSpot
              </h3>
              <p className="text-gray-300 mb-4">
                First, add the ScoreAI card to your deal records:
              </p>
              <ol className="space-y-3 text-gray-300 mb-6">
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">1.</span>
                  Go to Settings {'->'} Deals {'->'} Record Customization
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">2.</span>
                  Click on "Default View"
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">3.</span>
                  Click "Add Card"
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">4.</span>
                  Select "ScoreAI - Deal Score"
                </li>
              </ol>
              <p className="text-gray-300 mb-4">
                Once configured, open any Deal record in your CRM and you'll see:
              </p>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">✅</span>
                  An AI-generated score (0–100)
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">✅</span>
                  Top positives and negatives
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">✅</span>
                  A short executive summary
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0066FF]">✅</span>
                  Your usage (free or paid tier)
                </li>
              </ul>
            </div>

            {/* Step 4 */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">
                Step 4: AI Deal Scoring
              </h3>
              <div className="space-y-6">
                <div className="bg-white/5 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-white mb-3">Free Plan</h4>
                  <ul className="space-y-3 text-gray-300">
                    <li className="flex items-start gap-3">
                      <span className="text-[#0066FF]">•</span>
                      Click the "Score Deal" button to manually score up to 50 deals per month
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#0066FF]">•</span>
                      Perfect for testing the system and seeing how it works with your data
                    </li>
                  </ul>
                </div>

                <div className="bg-white/5 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-white mb-3">Paid Plans</h4>
                  <ul className="space-y-3 text-gray-300">
                    <li className="flex items-start gap-3">
                      <span className="text-[#0066FF]">•</span>
                      Automatic scoring of all new and updated deals
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#0066FF]">•</span>
                      Scores update in real-time as deal data changes
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#0066FF]">•</span>
                      AI model continuously learns from your closed deals
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-[#0066FF]">•</span>
                      Higher monthly deal scoring limits based on your plan
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Pro Tips Section */}
          <div className="bg-white/10 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">
              🧠 Pro Tips for Better Accuracy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                'Make sure your pipeline is up-to-date',
                'Use consistent deal values and stages',
                'Keep your historical Closed Won / Lost deals clean',
                'The more quality historical data, the better your scoring'
              ].map((tip, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-[#0066FF]">•</span>
                  <span className="text-gray-300">{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Need Help Section */}
          <div className="bg-white/10 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">
              🛠️ Need Help?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                'Book a quick onboarding call',
                'Email scott@acceleratewith.ai'
              ].map((option, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-[#0066FF]">•</span>
                  <span className="text-gray-300">{option}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Next Steps Section */}
          <div className="bg-white/10 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-white mb-6">
              🚀 Next Steps
            </h2>
            <div className="grid grid-cols-1 gap-4 mb-8">
              {[
                'Use the Free Plan to score up to 50 Deals per month',
                'Upgrade to a paid plan for automatic scoring and higher volumes',
                'Join our Partner Program and earn 40% recurring commission for referrals'
              ].map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-[#0066FF]">•</span>
                  <span className="text-gray-300">{step}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/pricing"
                className="inline-block bg-[#0066FF] text-white px-8 py-4 rounded-lg font-semibold hover:bg-[#0052CC] transition-colors text-center"
              >
                View Pricing Plans
              </Link>
              <Link
                href="/partner"
                className="inline-block bg-white/10 text-white px-8 py-4 rounded-lg font-semibold hover:bg-white/20 transition-colors text-center"
              >
                Join Partner Program
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 