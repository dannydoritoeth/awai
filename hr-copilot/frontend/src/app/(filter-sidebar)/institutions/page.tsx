'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { getInstitutions, type Institution } from '@/lib/services/institutions';

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInstitutions() {
      try {
        setLoading(true);
        const data = await getInstitutions();
        setInstitutions(data);
      } catch (error) {
        console.error('Error loading institutions:', error);
        setError(error instanceof Error ? error.message : 'Failed to load institutions');
      } finally {
        setLoading(false);
      }
    }
    loadInstitutions();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => (
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
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Institutions</h1>
      <p className="text-gray-600 mb-8">Browse organizations and their companies</p>
      
      <div className="grid gap-6">
        {institutions.map((institution) => (
          <Link key={institution.id} href={`/institutions/${institution.id}`}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{institution.name}</h2>
                    {institution.description && (
                      <p className="text-gray-600 mt-1">{institution.description}</p>
                    )}
                  </div>
                  {institution.logo_url && (
                    <img 
                      src={institution.logo_url} 
                      alt={`${institution.name} logo`}
                      className="w-12 h-12 object-contain"
                    />
                  )}
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="space-x-4">
                    <span>
                      <span className="font-medium text-gray-900">Companies: </span>
                      <span className="text-gray-600">{institution.company_count}</span>
                    </span>
                    <span>
                      <span className="font-medium text-gray-900">Divisions: </span>
                      <span className="text-gray-600">{institution.division_count}</span>
                    </span>
                  </div>
                  {institution.website_url && (
                    <a 
                      href={institution.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Visit Website
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {institutions.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No institutions found</h3>
            <p className="text-gray-600">Please try again later.</p>
          </div>
        )}
      </div>
    </div>
  );
} 