'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getCompanies, type Company } from '@/lib/services/companies';
import Link from 'next/link';

export default function CompaniesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        setLoading(true);
        const data = await getCompanies({
          searchTerm: searchTerm || undefined
        });
        setCompanies(data);
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
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Companies</h1>
      <p className="text-gray-600 mb-8">Explore companies across NSW Government</p>
      
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search companies..."
          className="w-full max-w-md px-4 py-2 border rounded-lg"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-6">
        {companies.map((company) => (
          <Link key={company.id} href={`/companies/${company.id}`}>
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-2 text-gray-900">{company.name}</h2>
                {company.description && (
                  <p className="text-gray-900 mb-4 line-clamp-3">{company.description}</p>
                )}
                {company.website && (
                  <p className="text-sm text-blue-900 hover:underline truncate">
                    {company.website}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}

        {companies.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No companies found</h3>
            <p className="text-gray-700">Try adjusting your search terms</p>
          </div>
        )}
      </div>
    </div>
  );
} 