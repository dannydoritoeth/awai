'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getTaxonomies } from '@/lib/services/data';
import Link from 'next/link';
import type { Taxonomy } from '@/lib/services/data';

export default function TaxonomiesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');

  useEffect(() => {
    const loadTaxonomies = async () => {
      try {
        const response = await getTaxonomies({
          searchTerm: searchTerm || undefined,
          taxonomyType: selectedType || undefined
        });

        if (response.success && response.data) {
          setTaxonomies(response.data);
        } else {
          setError(response.error || 'Failed to load taxonomies');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load taxonomies';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadTaxonomies();
  }, [searchTerm, selectedType]);

  const taxonomyTypes = ['core', 'function', 'theme', 'custom'];

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Taxonomies</h1>
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search taxonomies..."
            className="flex-1 px-4 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="px-4 py-2 border rounded-lg"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="">All Types</option>
            {taxonomyTypes.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {taxonomies.map((taxonomy) => (
          <Link key={taxonomy.id} href={`/taxonomies/${taxonomy.id}`}>
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-xl font-semibold">{taxonomy.name}</h2>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                    {taxonomy.taxonomy_type}
                  </span>
                </div>
                {taxonomy.description && (
                  <p className="text-gray-600 line-clamp-3">{taxonomy.description}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
} 