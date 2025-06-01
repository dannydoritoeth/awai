'use client';

import { useState, useEffect, use } from 'react';
import { getCompany } from '@/lib/services/companies';
import { useFilterStore } from '@/lib/stores/filter-store';
import CompanyAIInsights from '@/app/components/CompanyAIInsights';
import CompanyInfoPanel from '@/app/components/CompanyInfoPanel';
import type { Company } from '@/lib/services/companies';
import Link from 'next/link';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function CompanyPage(props: PageProps) {
  const params = use(props.params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const setFilters = useFilterStore(state => state.setFilters);

  useEffect(() => {
    async function loadCompany() {
      try {
        setLoading(true);
        const response = await getCompany(params.id);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to load company');
        }
        setCompany(response.data);
        // Set the company filter
        setFilters({
          company: params.id
        });
      } catch (error) {
        console.error('Error loading company:', error);
        setError(error instanceof Error ? error.message : 'Failed to load company');
      } finally {
        setLoading(false);
      }
    }
    loadCompany();

    // Clear the filter when unmounting
    return () => {
      setFilters({
        company: undefined
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

  if (!company) {
    return <div className="text-gray-900">Company not found</div>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Main Content Area */}
      <div className="flex-1 p-8">
        {/* Header */}
        <div className="mb-6">
          {/* Breadcrumb Navigation */}
          {company.institution && (
            <div className="text-sm text-gray-600 mb-2">
              <Link 
                href={`/institutions/${company.institution.id}`}
                className="hover:text-blue-600 hover:underline"
              >
                {company.institution.name}
              </Link>
            </div>
          )}
          <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
          {company.logo_url && (
            <img 
              src={company.logo_url} 
              alt={`${company.name} logo`}
              className="mt-4 w-20 h-20 object-contain"
            />
          )}
        </div>

        {/* AI Insights */}
        <CompanyAIInsights 
          companyId={company.id} 
          companyName={company.name}
        />

        {/* Divisions */}
        {company.divisions && company.divisions.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Divisions</h2>
            <div className="grid gap-4">
              {company.divisions.map((division) => (
                <Link 
                  key={division.id} 
                  href={`/divisions/${division.id}`}
                  className="block"
                >
                  <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                    <h3 className="text-xl font-semibold text-gray-900">{division.name}</h3>
                    <div className="mt-2 flex gap-2">
                      {division.cluster && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                          {division.cluster}
                        </span>
                      )}
                      {division.agency && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                          {division.agency}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {(!company.divisions || company.divisions.length === 0) && (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No divisions found</h3>
            <p className="text-gray-600">This company doesn&apos;t have any divisions yet.</p>
          </div>
        )}
      </div>

      {/* Right Info Panel */}
      <div className="w-80 flex-shrink-0 p-8">
        <CompanyInfoPanel company={company} />
      </div>
    </div>
  );
} 