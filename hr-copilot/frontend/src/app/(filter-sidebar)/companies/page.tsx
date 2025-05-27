'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getCompanies } from '@/lib/services/data';
import Link from 'next/link';
import type { Company } from '@/lib/services/data';

export default function CompaniesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const response = await getCompanies({
          searchTerm: searchTerm || undefined
        });

        if (response.success && response.data) {
          setCompanies(response.data);
        } else {
          setError(response.error || 'Failed to load companies');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load companies';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, [searchTerm]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Companies</h1>
        <input
          type="text"
          placeholder="Search companies..."
          className="w-full max-w-md px-4 py-2 border rounded-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map((company) => (
          <Link key={company.id} href={`/companies/${company.id}`}>
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-2">{company.name}</h2>
                {company.description && (
                  <p className="text-gray-600 mb-4 line-clamp-3">{company.description}</p>
                )}
                {company.website && (
                  <p className="text-sm text-blue-600 hover:underline truncate">
                    {company.website}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
} 