'use client';

import { useState, useEffect, use } from 'react';
import { getInstitution, type InstitutionDetail } from '@/lib/services/institutions';
import { useFilterStore } from '@/lib/stores/filter-store';
import InstitutionAIInsights from '@/app/components/InstitutionAIInsights';
import InstitutionInfoPanel from '@/app/components/InstitutionInfoPanel';

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
  const setFilters = useFilterStore(state => state.setFilters);

  useEffect(() => {
    async function loadInstitution() {
      try {
        setLoading(true);
        const data = await getInstitution(params.id);
        setInstitution(data);
        // Set the institution filter
        setFilters({
          institution: params.id
        });
      } catch (error) {
        console.error('Error loading institution:', error);
        setError(error instanceof Error ? error.message : 'Failed to load institution');
      } finally {
        setLoading(false);
      }
    }
    loadInstitution();

    // Clear the filter when unmounting
    return () => {
      setFilters({
        institution: undefined
      });
    };
  }, [params.id, setFilters]);

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
    <div className="flex min-h-screen">
      {/* Main Content Area */}
      <div className="flex-1 p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{institution.name}</h1>
          {institution.logo_url && (
            <img 
              src={institution.logo_url} 
              alt={`${institution.name} logo`}
              className="mt-4 w-20 h-20 object-contain"
            />
          )}
        </div>

        {/* AI Insights */}
        <InstitutionAIInsights 
          institutionId={institution.id} 
          institutionName={institution.name}
        />

        {/* Companies List */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Companies</h2>
          <div className="grid gap-4">
            {institution.companies.map((company) => (
              <div key={company.id} className="bg-white rounded-lg shadow-sm p-6">
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
              </div>
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

      {/* Right Info Panel */}
      <div className="w-80 flex-shrink-0 p-8">
        <InstitutionInfoPanel institution={institution} />
      </div>
    </div>
  );
} 