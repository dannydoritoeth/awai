'use client';

import { useState, useEffect, use } from 'react';
import { getDivision } from '@/lib/services/divisions';
import { useFilterStore } from '@/lib/stores/filter-store';
import DivisionAIInsights from '@/app/components/DivisionAIInsights';
import DivisionInfoPanel from '@/app/components/DivisionInfoPanel';
import type { Division } from '@/lib/services/divisions';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function DivisionPage(props: PageProps) {
  const params = use(props.params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [division, setDivision] = useState<Division | null>(null);
  const setFilters = useFilterStore(state => state.setFilters);

  useEffect(() => {
    async function loadDivision() {
      try {
        setLoading(true);
        const data = await getDivision(params.id);
        setDivision(data);
        // Set the division filter
        setFilters({
          division: params.id
        });
      } catch (error) {
        console.error('Error loading division:', error);
        setError(error instanceof Error ? error.message : 'Failed to load division');
      } finally {
        setLoading(false);
      }
    }
    loadDivision();

    // Clear the filter when unmounting
    return () => {
      setFilters({
        division: undefined
      });
    };
  }, [params.id, setFilters]);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-20 bg-gray-100 rounded-lg"></div>
      <div className="h-40 bg-gray-100 rounded-lg"></div>
    </div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!division) {
    return <div className="text-gray-900">Division not found</div>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Main Content Area */}
      <div className="flex-1 p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{division.name}</h1>
          <div className="mt-2 flex gap-2">
            {division.cluster && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                {division.cluster}
              </span>
            )}
            {division.agency && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                {division.agency}
              </span>
            )}
          </div>
        </div>

        {/* AI Insights */}
        <DivisionAIInsights 
          divisionId={division.id} 
          divisionName={division.name}
        />

        {/* Roles Section - Placeholder for now */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Roles</h2>
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No roles found</h3>
            <p className="text-gray-600">This division doesn&apos;t have any roles yet.</p>
          </div>
        </div>
      </div>

      {/* Right Info Panel */}
      <div className="w-80 flex-shrink-0 p-8">
        <DivisionInfoPanel division={division} />
      </div>
    </div>
  );
} 