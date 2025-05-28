'use client';

import { useState, useEffect, use } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getInstitution, type InstitutionDetail } from '@/lib/services/institutions';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function InstitutionPage(props: PageProps) {
  const params = use(props.params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [institution, setInstitution] = useState<InstitutionDetail | null>(null);

  useEffect(() => {
    async function loadInstitution() {
      try {
        setLoading(true);
        const data = await getInstitution(params.id);
        setInstitution(data);
      } catch (error) {
        console.error('Error loading institution:', error);
        setError(error instanceof Error ? error.message : 'Failed to load institution');
      } finally {
        setLoading(false);
      }
    }
    loadInstitution();
  }, [params.id]);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-20 bg-gray-100 rounded-lg"></div>
      <div className="h-40 bg-gray-100 rounded-lg"></div>
    </div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!institution) {
    return <div className="text-gray-900">Institution not found</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{institution.name}</h1>
          {institution.description && (
            <p className="mt-2 text-gray-600">{institution.description}</p>
          )}
        </div>
        {institution.logo_url && (
          <img 
            src={institution.logo_url} 
            alt={`${institution.name} logo`}
            className="w-20 h-20 object-contain"
          />
        )}
      </div>

      {/* Quick Stats */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Companies</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{institution.companies.length}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Divisions</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {institution.companies.reduce((acc, company) => acc + (company.divisions?.length || 0), 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Companies List */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Companies</h2>
        <div className="grid gap-4">
          {institution.companies.map((company) => (
            <Card key={company.id}>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-gray-900">{company.name}</h3>
                {company.description && (
                  <p className="mt-1 text-gray-600">{company.description}</p>
                )}
                
                {/* Divisions */}
                {company.divisions && company.divisions.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Divisions</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {company.divisions.map((division) => (
                        <div key={division.id} className="p-2 bg-gray-50 rounded">
                          <p className="font-medium text-gray-900">{division.name}</p>
                          {division.agency && (
                            <p className="text-sm text-gray-600">{division.agency}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {institution.companies.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No companies found</h3>
              <p className="text-gray-600">This institution doesn&apos;t have any companies yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 