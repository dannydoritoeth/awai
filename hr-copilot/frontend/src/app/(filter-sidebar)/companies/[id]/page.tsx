'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getCompany, type Company } from '@/lib/services/companies';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function CompanyDetailPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    const loadCompany = async () => {
      try {
        setLoading(true);
        const data = await getCompany(id as string);
        setCompany(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load company';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadCompany();
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

  if (!company) {
    return <div className="text-gray-900">Company not found</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">{company.name}</h1>
        {company.website && (
          <Link 
            href={company.website} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-900 hover:underline"
          >
            {company.website}
          </Link>
        )}
      </div>

      <div className="grid gap-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Overview</h2>
            {company.description && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Description</h3>
                <p className="text-gray-900">{company.description}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Created</h3>
              <p className="text-gray-900">
                {new Date(company.created_at).toLocaleDateString('en-AU', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Additional sections can be added here as needed */}
      </div>
    </div>
  );
} 