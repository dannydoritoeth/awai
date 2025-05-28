'use client';

import { useState, useEffect, use } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getTaxonomy } from '@/lib/services/data';
import type { Taxonomy } from '@/lib/services/data';

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
    <div className="container mx-auto py-8">
      {/* Taxonomy Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <h1 className="text-3xl font-bold text-gray-900">{taxonomy.name}</h1>
          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
            {taxonomy.taxonomy_type}
          </span>
        </div>
      </div>

      {/* Taxonomy Details */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">About</h2>
            {taxonomy.description ? (
              <p className="text-gray-700">{taxonomy.description}</p>
            ) : (
              <p className="text-gray-700 italic">No description available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Related Roles */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">Related Roles</h2>
            <div className="space-y-4">
              {/* TODO: Add related roles list when available */}
              <p className="text-gray-700 italic">Related roles will be displayed here</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Statistics */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900">Usage Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Total Roles</h3>
              <p className="text-3xl font-semibold text-blue-600">--</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Divisions</h3>
              <p className="text-3xl font-semibold text-blue-600">--</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Companies</h3>
              <p className="text-3xl font-semibold text-blue-600">--</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 