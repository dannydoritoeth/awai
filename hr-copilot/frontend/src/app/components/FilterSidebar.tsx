'use client';

import { useState, useEffect } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getDivisions, type Division } from '@/lib/services/divisions';
import { getCategories } from '@/lib/services/categories';
import { CheckboxGroup } from '@/components/ui/checkbox-group';
import { HierarchyNav } from '@/components/ui/hierarchy-nav';

interface FilterOption {
  id: string;
  name: string;
  checked: boolean;
}

interface Filters {
  capability?: string;
  careerType?: string;
}

interface FilterSidebarProps {
  children: React.ReactNode;
  onFiltersChange?: (filters: Filters) => void;
}

export default function FilterSidebar({ children, onFiltersChange }: FilterSidebarProps) {
  console.log('FilterSidebar rendered');
  
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const pathname = usePathname();
  const params = useParams();

  // Filter states
  const [filters, setFilters] = useState<Filters>({});
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [capabilities, setCapabilities] = useState<FilterOption[]>([]);
  const [careerTypes, setCareerTypes] = useState<FilterOption[]>([]);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        console.log('Starting to load filter options...');
        console.log('Current pathname:', pathname);
        console.log('Current params:', params);

        // Load all filter options
        console.log('Fetching data from services...');
        const [divisionData, taxonomyData, capabilityData] = await Promise.all([
          getDivisions().catch(err => {
            console.error('Error loading divisions:', err);
            return [];
          }),
          getCategories('taxonomy').catch(err => {
            console.error('Error loading taxonomy:', err);
            return [];
          }),
          getCategories('capability').catch(err => {
            console.error('Error loading capabilities:', err);
            return [];
          })
        ]);

        console.log('Received division data:', JSON.stringify(divisionData, null, 2));

        // Transform data to FilterOption format with checked state
        const transformToFilterOptions = (items: { id: string; name: string }[]): FilterOption[] => {
          return items.map(item => ({
            id: item.id,
            name: item.name,
            checked: false
          }));
        };

        setDivisions(divisionData);
        console.log('Set divisions state:', divisionData);
        
        setCareerTypes(transformToFilterOptions(taxonomyData));
        setCapabilities(transformToFilterOptions(capabilityData));

        // Set initial capability filter if we're on a capability page
        if (pathname.includes('/capabilities/') && params.id) {
          console.log('Setting initial capability filter:', params.id);
          setFilters(prev => {
            const newFilters = {
              ...prev,
              capability: params.id as string
            };
            console.log('Updated filters:', newFilters);
            return newFilters;
          });
        }
      } catch (error) {
        console.error('Error in loadFilterOptions:', error);
      }
    };

    loadFilterOptions();
  }, [pathname, params.id]);

  const handleFilterChange = (type: keyof Filters, id: string, checked: boolean) => {
    console.log('Changing filter:', { type, id, checked });
    
    // Update the checked state in the corresponding filter options
    const updateOptions = (options: FilterOption[], setOptions: (options: FilterOption[]) => void) => {
      const newOptions = options.map(option => 
        option.id === id ? { ...option, checked } : option
      );
      setOptions(newOptions);
    };

    switch (type) {
      case 'capability':
        updateOptions(capabilities, setCapabilities);
        break;
      case 'careerType':
        updateOptions(careerTypes, setCareerTypes);
        break;
    }

    // Update the filters state
    const newFilters = {
      ...filters,
      [type]: checked ? id : undefined
    };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  const handleClearFilters = () => {
    console.log('Clearing all filters');
    const newFilters = {};
    setFilters(newFilters);
    onFiltersChange?.(newFilters as Filters);
    
    // Reset all checked states
    setCapabilities(capabilities.map(c => ({ ...c, checked: false })));
    setCareerTypes(careerTypes.map(t => ({ ...t, checked: false })));
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
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
        className={`fixed top-0 left-0 h-full bg-white text-gray-900 transition-all duration-300 z-4 border-r border-gray-200
          ${isMenuOpen ? 'w-[235px]' : 'w-0 overflow-hidden'}`}
      >
        <div className="flex flex-col h-full w-[235px]">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 h-16">
            <h2 className="text-[14px] font-medium text-gray-900">.</h2>
          </div>

          {/* Filters */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Hierarchy Navigation */}
            <div className="mb-6">
              <h3 className="text-[14px] font-medium text-gray-900 mb-2">Organization</h3>
              <HierarchyNav
                divisions={divisions}
              />
            </div>

            <CheckboxGroup
              title="Capabilities"
              options={capabilities}
              onChange={(id, checked) => handleFilterChange('capability', id, checked)}
            />

            <CheckboxGroup
              title="Career Types"
              options={careerTypes}
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

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isMenuOpen ? 'ml-[235px]' : 'ml-0'}`}>
        {/* Top Bar */}
        <div className="sticky top-0 z-40 flex items-center h-16 bg-white border-b border-gray-200">
          <div className={`flex items-center ${isMenuOpen ? 'pl-4' : 'pl-20'}`}>
            <div className="text-lg font-semibold text-gray-900">
              {pathname.split('/')[1]?.charAt(0).toUpperCase() + pathname.split('/')[1]?.slice(1) || 'TalentPathAI'}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
} 