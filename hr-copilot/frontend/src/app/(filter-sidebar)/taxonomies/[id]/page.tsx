'use client';

import { useState, useEffect, use } from 'react';
import { getTaxonomy } from '@/lib/services/data';
import type { Taxonomy } from '@/lib/services/data';
import type { Filters } from '@/app/components/RoleFilters';
import AIInsightsPanel from '@/app/components/AIInsightsPanel';
import TaxonomyInfoPanel from '@/app/components/TaxonomyInfoPanel';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function TaxonomyPage(props: PageProps) {
  const params = use(props.params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);

  useEffect(() => {
    const loadTaxonomy = async () => {
      try {
        const response = await getTaxonomy(params.id);

        if (response.success && response.data) {
          setTaxonomy(response.data);
        } else {
          setError(response.error || 'Failed to load taxonomy');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load taxonomy';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadTaxonomy();
  }, [params.id]);

  if (loading) {
    return <div className="text-gray-900">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!taxonomy) {
    return <div className="text-gray-900">Taxonomy not found</div>;
  }

  return (
    <div className="flex gap-6 p-8 min-h-screen">


      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <h1 className="text-3xl font-bold text-gray-900">{taxonomy.name}</h1>
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
              {taxonomy.taxonomy_type}
            </span>
          </div>
        </div>

        {/* AI Insights Panel */}
        <AIInsightsPanel taxonomyId={taxonomy.id} taxonomyName={taxonomy.name} />

        {/* Roles List */}
        <div className="space-y-4">
          {/* TODO: Add roles list component */}
          <p className="text-gray-700 italic">Roles list will be displayed here</p>
        </div>
      </div>

      {/* Right Info Panel */}
      <div className="w-80 flex-shrink-0">
        <TaxonomyInfoPanel taxonomy={taxonomy} />
      </div>
    </div>
  );
} 