'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RoleFilters } from '@/lib/services/data';
import {
  getTaxonomies,
  getRegions,
  getDivisions,
  getEmploymentTypes,
  getCompanies
} from '@/lib/services/data';

interface FilterOption {
  id: string;
  label: string;
  checked: boolean;
}

interface RoleFiltersSidebarProps {
  onFiltersChange: (filters: RoleFilters) => void;
}

export function RoleFiltersSidebar({ onFiltersChange }: RoleFiltersSidebarProps) {
  const [taxonomies, setTaxonomies] = useState<FilterOption[]>([]);
  const [regions, setRegions] = useState<FilterOption[]>([]);
  const [divisions, setDivisions] = useState<FilterOption[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<FilterOption[]>([]);
  const [companies, setCompanies] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [
          taxonomyList,
          regionList,
          divisionList,
          employmentTypeList,
          companyList
        ] = await Promise.all([
          getTaxonomies(),
          getRegions(),
          getDivisions(),
          getEmploymentTypes(),
          getCompanies()
        ]);

        setTaxonomies(taxonomyList.map(t => ({ id: t, label: t, checked: false })));
        setRegions(regionList.map(r => ({ id: r, label: r, checked: false })));
        setDivisions(divisionList.map(d => ({ id: d, label: d, checked: false })));
        setEmploymentTypes(employmentTypeList.map(e => ({ id: e, label: e, checked: false })));
        setCompanies(companyList.map(c => ({ id: c, label: c, checked: false })));
      } catch (error) {
        console.error('Failed to load filter options:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFilterOptions();
  }, []);

  const updateFilters = (
    category: keyof RoleFilters,
    options: FilterOption[],
    setOptions: (options: FilterOption[]) => void,
    optionId: string,
    checked: boolean
  ) => {
    const updatedOptions = options.map(option =>
      option.id === optionId ? { ...option, checked } : option
    );
    setOptions(updatedOptions);

    const selectedOptions = updatedOptions
      .filter(option => option.checked)
      .map(option => option.id);

    onFiltersChange({
      taxonomies: category === 'taxonomies' ? selectedOptions : taxonomies.filter(t => t.checked).map(t => t.id),
      regions: category === 'regions' ? selectedOptions : regions.filter(r => r.checked).map(r => r.id),
      divisions: category === 'divisions' ? selectedOptions : divisions.filter(d => d.checked).map(d => d.id),
      employmentTypes: category === 'employmentTypes' ? selectedOptions : employmentTypes.filter(e => e.checked).map(e => e.id),
      companies: category === 'companies' ? selectedOptions : companies.filter(c => c.checked).map(c => c.id),
    });
  };

  if (loading) {
    return <div>Loading filters...</div>;
  }

  return (
    <Card className="w-64">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold mb-4">Filter By</h2>

        {/* Taxonomy Section */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Taxonomy</h3>
          <div className="space-y-2">
            {taxonomies.map(taxonomy => (
              <div key={taxonomy.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`taxonomy-${taxonomy.id}`}
                  checked={taxonomy.checked}
                  onCheckedChange={(checked) =>
                    updateFilters('taxonomies', taxonomies, setTaxonomies, taxonomy.id, checked as boolean)
                  }
                />
                <Label htmlFor={`taxonomy-${taxonomy.id}`}>{taxonomy.label}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* Region Section */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Region</h3>
          <div className="space-y-2">
            {regions.map(region => (
              <div key={region.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`region-${region.id}`}
                  checked={region.checked}
                  onCheckedChange={(checked) =>
                    updateFilters('regions', regions, setRegions, region.id, checked as boolean)
                  }
                />
                <Label htmlFor={`region-${region.id}`}>{region.label}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* Division Section */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Division</h3>
          <div className="space-y-2">
            {divisions.map(division => (
              <div key={division.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`division-${division.id}`}
                  checked={division.checked}
                  onCheckedChange={(checked) =>
                    updateFilters('divisions', divisions, setDivisions, division.id, checked as boolean)
                  }
                />
                <Label htmlFor={`division-${division.id}`}>{division.label}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* Employment Type Section */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Employment Type</h3>
          <div className="space-y-2">
            {employmentTypes.map(type => (
              <div key={type.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type.id}`}
                  checked={type.checked}
                  onCheckedChange={(checked) =>
                    updateFilters('employmentTypes', employmentTypes, setEmploymentTypes, type.id, checked as boolean)
                  }
                />
                <Label htmlFor={`type-${type.id}`}>{type.label}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* Companies Section */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Companies</h3>
          <div className="space-y-2">
            {companies.map(company => (
              <div key={company.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`company-${company.id}`}
                  checked={company.checked}
                  onCheckedChange={(checked) =>
                    updateFilters('companies', companies, setCompanies, company.id, checked as boolean)
                  }
                />
                <Label htmlFor={`company-${company.id}`}>{company.label}</Label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 