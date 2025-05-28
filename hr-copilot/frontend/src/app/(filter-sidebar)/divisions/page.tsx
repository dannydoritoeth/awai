'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getDivisions, type Division } from '@/lib/services/divisions';
import Link from 'next/link';

export default function DivisionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadDivisions = async () => {
      try {
        setLoading(true);
        const data = await getDivisions({
          searchTerm: searchTerm || undefined
        });
        setDivisions(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load divisions';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadDivisions();
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 bg-gray-100 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Divisions</h1>
      <p className="text-gray-600 mb-8">Explore divisions and agencies across NSW Government</p>
      
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search divisions..."
          className="w-full max-w-md px-4 py-2 border rounded-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-6">
        {divisions.map((division) => (
          <Link key={division.id} href={`/divisions/${division.id}`}>
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-2 text-gray-900">{division.name}</h2>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-900">
                    {division.agency}
                  </span>
                  {division.cluster && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-900">
                      {division.cluster}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {divisions.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No divisions found</h3>
            <p className="text-gray-700">Try adjusting your search terms</p>
          </div>
        )}
      </div>
    </div>
  );
} 