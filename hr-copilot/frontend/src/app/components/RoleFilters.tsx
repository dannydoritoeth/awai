'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getTaxonomies, getBands, getAgencies } from '@/lib/services/roles';

interface FilterOption {
  id: string;
  name: string;
}

export default function RoleFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [taxonomies, setTaxonomies] = useState<FilterOption[]>([]);
  const [bands, setBands] = useState<FilterOption[]>([]);
  const [agencies, setAgencies] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [taxonomyData, bandData, agencyData] = await Promise.all([
          getTaxonomies(),
          getBands(),
          getAgencies(),
        ]);
        setTaxonomies(taxonomyData);
        setBands(bandData);
        setAgencies(agencyData);
      } catch (error) {
        console.error('Error loading filter options:', error);
      } finally {
        setLoading(false);
      }
    }
    loadFilterOptions();
  }, []);

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const handleFilterChange = (name: string, value: string) => {
    router.push(pathname + '?' + createQueryString(name, value));
  };

  if (loading) {
    return <div className="p-4">Loading filters...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Taxonomy Filter */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Function/Theme</h3>
        <select
          className="w-full rounded-md border border-gray-300 py-2 px-3"
          value={searchParams.get('taxonomy') || ''}
          onChange={(e) => handleFilterChange('taxonomy', e.target.value)}
        >
          <option value="">All Functions</option>
          {taxonomies.map((taxonomy) => (
            <option key={taxonomy.id} value={taxonomy.id}>
              {taxonomy.name}
            </option>
          ))}
        </select>
      </div>

      {/* Band Filter */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Classification Band</h3>
        <select
          className="w-full rounded-md border border-gray-300 py-2 px-3"
          value={searchParams.get('band') || ''}
          onChange={(e) => handleFilterChange('band', e.target.value)}
        >
          <option value="">All Bands</option>
          {bands.map((band) => (
            <option key={band.id} value={band.id}>
              {band.name}
            </option>
          ))}
        </select>
      </div>

      {/* Agency Filter */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Agency</h3>
        <select
          className="w-full rounded-md border border-gray-300 py-2 px-3"
          value={searchParams.get('agency') || ''}
          onChange={(e) => handleFilterChange('agency', e.target.value)}
        >
          <option value="">All Agencies</option>
          {agencies.map((agency) => (
            <option key={agency.id} value={agency.id}>
              {agency.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
} 