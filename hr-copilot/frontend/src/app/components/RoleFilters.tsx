'use client';

import { useState, useEffect } from 'react';
import { getDivisions, type Division } from '@/lib/services/divisions';
import { getCategories } from '@/lib/services/categories';
import { Select } from '@/components/ui/select';

interface FilterOption {
  id: string;
  name: string;
}

interface Filters {
  taxonomy: string;
  agency: string;
}

interface RoleFiltersProps {
  onFilterChange: (filters: Filters) => void;
}

export default function RoleFilters({ onFilterChange }: RoleFiltersProps) {
  const [loading, setLoading] = useState(true);
  const [taxonomies, setTaxonomies] = useState<FilterOption[]>([]);
  const [agencies, setAgencies] = useState<string[]>([]);
  const [selectedTaxonomy, setSelectedTaxonomy] = useState('');
  const [selectedAgency, setSelectedAgency] = useState('');

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        setLoading(true);
        
        // Load taxonomies
        const taxonomyData = await getCategories('taxonomy');
        setTaxonomies(taxonomyData.map((t: FilterOption) => ({
          id: t.id,
          name: t.name
        })));

        // Load divisions for agencies
        const divisionData = await getDivisions();
        const agencies = divisionData.map((d: Division) => d.agency);
        setAgencies([...new Set<string>(agencies)]);
      } catch (error) {
        console.error('Error loading filter options:', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    loadFilterOptions();
  }, []);

  const handleTaxonomyChange = (value: string) => {
    setSelectedTaxonomy(value);
    onFilterChange({
      taxonomy: value,
      agency: selectedAgency
    });
  };

  const handleAgencyChange = (value: string) => {
    setSelectedAgency(value);
    onFilterChange({
      taxonomy: selectedTaxonomy,
      agency: value
    });
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-10 bg-gray-100 rounded"></div>
      <div className="h-10 bg-gray-100 rounded"></div>
    </div>;
  }

  return (
    <div className="space-y-4">
      <Select
        label="Function Area"
        value={selectedTaxonomy}
        onChange={handleTaxonomyChange}
        options={taxonomies.map(t => ({
          value: t.id,
          label: t.name
        }))}
        placeholder="Select function area"
      />

      <Select
        label="Agency"
        value={selectedAgency}
        onChange={handleAgencyChange}
        options={agencies.map(agency => ({
          value: agency,
          label: agency
        }))}
        placeholder="Select agency"
      />
    </div>
  );
} 