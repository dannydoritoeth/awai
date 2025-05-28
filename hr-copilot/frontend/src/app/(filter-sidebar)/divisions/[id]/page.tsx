'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getDivision, type Division } from '@/lib/services/divisions';
import { Card, CardContent } from '@/components/ui/card';

export default function DivisionDetailPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [division, setDivision] = useState<Division | null>(null);

  useEffect(() => {
    const loadDivision = async () => {
      try {
        setLoading(true);
        const data = await getDivision(id as string);
        setDivision(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load division';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadDivision();
  }, [id]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-100 rounded w-1/3"></div>
        <div className="h-4 bg-gray-100 rounded w-2/3"></div>
        <div className="h-40 bg-gray-100 rounded mt-8"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!division) {
    return <div className="text-gray-900">Division not found</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">{division.name}</h1>
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
      </div>

      <div className="grid gap-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Overview</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Agency</h3>
                <p className="mt-1 text-gray-900">{division.agency}</p>
              </div>
              {division.cluster && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Cluster</h3>
                  <p className="mt-1 text-gray-900">{division.cluster}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Additional sections can be added here as needed */}
      </div>
    </div>
  );
} 