'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getCompany } from '@/lib/services/data';

import type { Company } from '@/lib/services/data';

interface PageProps {
  params: {
    id: string;
  };
}

export default function CompanyPage({ params }: PageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    const loadCompany = async () => {
      try {
        const response = await getCompany(params.id);

        if (response.success && response.data) {
          setCompany(response.data);
        } else {
          setError(response.error || 'Failed to load company');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load company';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadCompany();
  }, [params.id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!company) {
    return <div>Company not found</div>;
  }

  return (
    <div className="container mx-auto py-8">
      {/* Company Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{company.name}</h1>
        {company.website && (
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {company.website}
          </a>
        )}
      </div>

      {/* Company Details */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">About</h2>
            {company.description ? (
              <p className="text-gray-600">{company.description}</p>
            ) : (
              <p className="text-gray-500 italic">No description available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Divisions */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Divisions</h2>
            <div className="space-y-4">
              {/* TODO: Add divisions list when available */}
              <p className="text-gray-500 italic">Divisions will be displayed here</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Roles */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Available Roles</h2>
          <div className="space-y-4">
            {/* TODO: Add roles list when available */}
            <p className="text-gray-500 italic">Roles will be displayed here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 