'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startSession } from '@/lib/api/chat';
import { getBrowserSessionId } from '@/lib/browserSession';
import { events, EVENT_NAMES } from '@/lib/events';

// Define available insights
const insights = [
  {
    id: 'generateCapabilityHeatmapByTaxonomy',
    title: 'Capability Heatmap by Taxonomy Group',
    description: 'Visualize capability distribution across different taxonomy groups in your organization.',
    icon: '📊'
  },
  {
    id: 'generateCapabilityHeatmapByDivision',
    title: 'Capability Heatmap by Division',
    description: 'Analyze how capabilities are distributed across different divisions.',
    icon: '🏢'
  },
  {
    id: 'generateCapabilityHeatmapByRegion',
    title: 'Capability Heatmap by Region',
    description: 'Explore capability distribution across geographical regions.',
    icon: '🌍'
  },
  {
    id: 'generateCapabilityHeatmapByCompany',
    title: 'Organization-wide Capability Heatmap',
    description: 'Get a comprehensive view of capability distribution across your entire organization.',
    icon: '🎯'
  }
];

export default function InsightsPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleInsightClick = async (insight: typeof insights[0]) => {
    setError(null);
    setIsLoading(insight.id);
    
    try {
      const browserSessionId = getBrowserSessionId();
      // TODO: In a real implementation, get the companyIds from user context/state management
      const companyIds = ["98071d5d-02a0-4f0e-b13c-01cc61e5e6b4"]; // This should come from user context
      
      const response = await startSession({
        action: 'startSession',
        insightId: insight.id,
        companyIds,
        browserSessionId,
        message: `Provide analysis for the following heatmap: ${insight.title}`
      });

      if (!response.sessionId) {
        throw new Error('No sessionId returned from API.');
      }

      events.emit(EVENT_NAMES.SESSION_CREATED);
      router.push(`/c/${response.sessionId}?context=insight`);
    } catch (error) {
      console.error('Failed to start insight session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start insight session');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/50 backdrop-blur-sm py-8 px-4 rounded-3xl shadow-sm mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-4 tracking-tight text-center">
            Organizational Insights
          </h1>
          <p className="text-xl text-blue-950 text-center mb-4">
            Explore data-driven insights about your organization&apos;s capabilities and workforce distribution.
          </p>
        </div>

        <div className="grid gap-6">
          {insights.map((insight) => (
            <div
              key={`${insight.id}-${insight.scope}`}
              className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="text-4xl">{insight.icon}</div>
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    {insight.title}
                  </h2>
                  <p className="text-gray-600 mb-4">
                    {insight.description}
                  </p>
                  <button
                    onClick={() => handleInsightClick(insight)}
                    disabled={isLoading === insight.id}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLoading === insight.id ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <span>View Insight</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
              {error && isLoading === insight.id && (
                <p className="text-sm text-red-600 mt-2">{error}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
} 