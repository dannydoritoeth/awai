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
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const pathname = usePathname();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [capabilities, setCapabilities] = useState<FilterOption[]>([]);
  const [careerTypes, setCareerTypes] = useState<FilterOption[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({
    capability: [],
    taxonomy: []
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [companiesData, capabilitiesData, careerTypesData] = await Promise.all([
          getCompanies(),
          getCategories('capability'),
          getCategories('taxonomy')
        ]);

        setCompanies(companiesData);
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
        console.error('Error loading data:', error);
      }
    }
    loadData();
  }, []);

  const handleFilterChange = (type: string, id: string, checked: boolean) => {
    setSelectedFilters(prev => {
      const newFilters = {
        ...prev,
        [type]: checked 
          ? [...prev[type], id]
          : prev[type].filter(filterId => filterId !== id)
      };
      onFiltersChange?.(newFilters);
      return newFilters;
    });
  };

  return (
    <div className="flex min-h-screen">
      {/* Menu Toggle Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={`fixed top-4 left-4 z-50 p-2 hover:bg-gray-100 transition-colors rounded-lg bg-white shadow-sm`}
      >
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <div 
        className={`top-0 left-0 h-full bg-white text-gray-900 transition-all duration-300 z-4 border-r border-gray-200
          ${isMenuOpen ? 'w-[235px]' : 'w-0 overflow-hidden'}`}
      >
        <div className="flex flex-col h-full w-[235px]">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 h-16">
            <h2 className="text-[14px] font-medium text-gray-900">Filters</h2>
          </div>

          {/* Filters */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Organization Hierarchy */}
            <div className="mb-6">
              <h3 className="text-[14px] font-medium text-gray-900 mb-2">Organization</h3>
              <HierarchyNav companies={companies} />
            </div>

            <CheckboxGroup
              title="Capabilities"
              options={capabilities.map(c => ({
                ...c,
                checked: selectedFilters.capability.includes(c.id)
              }))}
              onChange={(id, checked) => handleFilterChange('capability', id, checked)}
            />

            <CheckboxGroup
              title="Career Types"
              options={careerTypes.map(c => ({
                ...c,
                checked: selectedFilters.taxonomy.includes(c.id)
              }))}
              onChange={(id, checked) => handleFilterChange('taxonomy', id, checked)}
            />

            {/* Clear Filters Button */}
            <Button
              variant="outline"
              className="w-full text-[14px]"
              onClick={() => {
                setSelectedFilters({
                  capability: [],
                  taxonomy: []
                });
                setCapabilities(prev => prev.map(c => ({ ...c, checked: false })));
                setCareerTypes(prev => prev.map(c => ({ ...c, checked: false })));
                onFiltersChange?.({
                  capability: [],
                  taxonomy: []
                });
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-screen bg-white transition-all duration-300 ${isMenuOpen ? 'ml-[0px]' : 'ml-0'}`}>
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className={`flex items-center h-16 ${isMenuOpen ? 'pl-4' : 'pl-20'}`}>
            <div className="text-lg font-semibold text-gray-900">
              {pathname.split('/')[1]?.charAt(0).toUpperCase() + pathname.split('/')[1]?.slice(1) || 'TalentPathAI'}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 bg-white">
          {children}
        </div>
      </div>
    </div>
  );
} 