'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getCompanies, type Company } from '@/lib/services/companies';
import { getCategories } from '@/lib/services/categories';
import { CheckboxGroup } from '@/components/ui/checkbox-group';
import { HierarchyNav } from '@/components/ui/hierarchy-nav';

interface FilterOption {
  id: string;
  name: string;
  checked: boolean;
}

interface FilterSidebarProps {
  children: React.ReactNode;
  onFiltersChange?: (filters: Record<string, string[]>) => void;
}

export default function FilterSidebar({ children, onFiltersChange }: FilterSidebarProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [capabilities, setCapabilities] = useState<FilterOption[]>([]);
  const [careerTypes, setCareerTypes] = useState<FilterOption[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({
    capability: [],
    careerType: []
  });

  useEffect(() => {
    async function loadData() {
      try {
        const companiesData = await getCompanies();
        setCompanies(companiesData);

        const [capabilitiesData, careerTypesData] = await Promise.all([
          getCategories('capability'),
          getCategories('taxonomy')
        ]);

        setCapabilities(capabilitiesData.map((c: { id: string; name: string }) => ({ 
          id: c.id, 
          name: c.name, 
          checked: false 
        })));
        setCareerTypes(careerTypesData.map((c: { id: string; name: string }) => ({ 
          id: c.id, 
          name: c.name, 
          checked: false 
        })));
      } catch (error) {
        console.error('Error loading filter data:', error);
      }
    }
    loadData();
  }, []);

  const handleFilterChange = (type: string, id: string, checked: boolean) => {
    setSelectedFilters(prev => {
      const newFilters = { ...prev };
      if (checked) {
        newFilters[type] = [...(prev[type] || []), id];
      } else {
        newFilters[type] = (prev[type] || []).filter(filterId => filterId !== id);
      }
      onFiltersChange?.(newFilters);
      return newFilters;
    });
  };

  const handleClearFilters = () => {
    setSelectedFilters({
      capability: [],
      careerType: []
    });
    setCapabilities(prev => prev.map(c => ({ ...c, checked: false })));
    setCareerTypes(prev => prev.map(c => ({ ...c, checked: false })));
    onFiltersChange?.({
      capability: [],
      careerType: []
    });
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-white border-r border-gray-200 transition-all duration-300 ${
          isMenuOpen ? 'w-64' : 'w-0'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            <Button
              variant="outline"
              className="p-2 h-auto"
              onClick={() => setIsMenuOpen(false)}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Hierarchy Navigation */}
            <div className="mb-6">
              <h3 className="text-[14px] font-medium text-gray-900 mb-2">Organization</h3>
              <HierarchyNav companies={companies} />
            </div>

            <CheckboxGroup
              title="Capabilities"
              options={capabilities.map((c: FilterOption) => ({
                ...c,
                checked: selectedFilters.capability.includes(c.id)
              }))}
              onChange={(id, checked) => handleFilterChange('capability', id, checked)}
            />

            <CheckboxGroup
              title="Career Types"
              options={careerTypes.map((c: FilterOption) => ({
                ...c,
                checked: selectedFilters.careerType.includes(c.id)
              }))}
              onChange={(id, checked) => handleFilterChange('careerType', id, checked)}
            />

            {/* Clear Filters Button */}
            <Button
              onClick={handleClearFilters}
              variant="outline"
              className="w-full text-[14px]"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Menu Toggle Button - Only show when sidebar is closed */}
      {!isMenuOpen && (
        <button
          onClick={() => setIsMenuOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 hover:bg-gray-100 rounded-lg bg-white shadow-sm"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isMenuOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex items-center h-16 px-4">
            <div className="text-lg font-semibold text-gray-900">
              {pathname.split('/')[1]?.charAt(0).toUpperCase() + pathname.split('/')[1]?.slice(1) || 'TalentPathAI'}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 p-4">
          {children}
        </div>
      </div>
    </div>
  );
} 