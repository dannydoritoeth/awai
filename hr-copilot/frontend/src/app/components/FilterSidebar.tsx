'use client';

import { useState, useEffect } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { CustomSelect } from '@/components/ui/custom-select';
import { Button } from '@/components/ui/button';
import { getDivisions } from '@/lib/services/divisions';
import { getCategories } from '@/lib/services/categories';
import type { Division } from '@/lib/services/divisions';
import type { Category } from '@/lib/services/categories';

interface FilterOption {
  id: string;
  name: string;
}

interface Filters {
  division?: string;
  capability?: string;
  skill?: string;
  careerType?: string;
}

interface FilterSidebarProps {
  children: React.ReactNode;
}

export default function FilterSidebar({ children }: FilterSidebarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const pathname = usePathname();
  const params = useParams();

  // Filter states
  const [filters, setFilters] = useState<Filters>({});
  const [divisions, setDivisions] = useState<FilterOption[]>([]);
  const [capabilities, setCapabilities] = useState<FilterOption[]>([]);
  const [skills, setSkills] = useState<FilterOption[]>([]);
  const [careerTypes, setCareerTypes] = useState<FilterOption[]>([]);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        console.log('Starting to load filter options...');
        console.log('Current pathname:', pathname);
        console.log('Current params:', params);

        // Load all filter options
        console.log('Fetching data from services...');
        const [divisionData, taxonomyData, capabilityData, skillData] = await Promise.all([
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
          }),
          getCategories('skill').catch(err => {
            console.error('Error loading skills:', err);
            return [];
          })
        ]);

        console.log('Received data:', {
          divisions: divisionData,
          taxonomy: taxonomyData,
          capabilities: capabilityData,
          skills: skillData
        });

        // Transform data to FilterOption format
        const transformDivisions = (items: Division[]): FilterOption[] => {
          return items.map(item => ({
            id: item.id,
            name: item.name
          }));
        };

        const transformCategories = (items: Category[]): FilterOption[] => {
          return items.map(item => ({
            id: item.id,
            name: item.name
          }));
        };

        const transformedDivisions = transformDivisions(divisionData);
        const transformedCareerTypes = transformCategories(taxonomyData);
        const transformedCapabilities = transformCategories(capabilityData);
        const transformedSkills = transformCategories(skillData);

        console.log('Transformed data:', {
          divisions: transformedDivisions,
          careerTypes: transformedCareerTypes,
          capabilities: transformedCapabilities,
          skills: transformedSkills
        });

        setDivisions(transformedDivisions);
        setCareerTypes(transformedCareerTypes);
        setCapabilities(transformedCapabilities);
        setSkills(transformedSkills);

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
        if (error instanceof Error) {
          console.error('Error details:', {
            message: error.message,
            stack: error.stack
          });
        }
      }
    };

    loadFilterOptions();
  }, [pathname, params.id]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    console.log('Changing filter:', { key, value });
    setFilters(prev => {
      const newFilters = {
        ...prev,
        [key]: value
      };
      console.log('New filters state:', newFilters);
      return newFilters;
    });
  };

  const handleClearFilters = () => {
    console.log('Clearing all filters');
    setFilters({});
  };

  // Helper function to get the page title based on the pathname
  const getPageTitle = () => {
    if (pathname.includes('/taxonomies')) return 'Career Types';
    if (pathname.includes('/skills')) return 'Skills';
    if (pathname.includes('/capabilities')) return 'Capabilities';
    if (pathname.includes('/roles')) return 'Roles';
    return 'TalentPathAI';
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
        className={`fixed top-0 left-0 h-full bg-white text-gray-900 transition-all duration-300 z-40 border-r border-gray-200
          ${isMenuOpen ? 'w-80' : 'w-0 overflow-hidden'}`}
      >
        <div className="flex flex-col h-full w-80">
          {/* Header */}
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Filter Panel</h2>
          </div>

          {/* Filters */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Division */}
            <div className="space-y-4">
              <CustomSelect
                label="Division"
                value={filters.division || ''}
                onChange={(value) => handleFilterChange('division', value)}
                options={divisions.map(d => ({
                  value: d.id,
                  label: d.name
                }))}
                placeholder="Select division"
              />
            </div>

            {/* Other Filters */}
            <div className="space-y-4">
              <CustomSelect
                label="Capability"
                value={filters.capability || ''}
                onChange={(value) => handleFilterChange('capability', value)}
                options={capabilities.map(c => ({
                  value: c.id,
                  label: c.name
                }))}
                placeholder="Select capability"
              />

              <CustomSelect
                label="Skill"
                value={filters.skill || ''}
                onChange={(value) => handleFilterChange('skill', value)}
                options={skills.map(s => ({
                  value: s.id,
                  label: s.name
                }))}
                placeholder="Select skill"
              />

              <CustomSelect
                label="Career Type"
                value={filters.careerType || ''}
                onChange={(value) => handleFilterChange('careerType', value)}
                options={careerTypes.map(t => ({
                  value: t.id,
                  label: t.name
                }))}
                placeholder="Select career type"
              />
            </div>

            {/* Clear Filters Button */}
            <Button
              onClick={handleClearFilters}
              variant="outline"
              className="w-full"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isMenuOpen ? 'ml-80' : 'ml-0'}`}>
        {/* Top Bar */}
        <div className="sticky top-0 z-40 flex items-center h-16 bg-white border-b border-gray-200">
          <div className={`flex items-center ${isMenuOpen ? 'pl-4' : 'pl-20'}`}>
            <div className="text-lg font-semibold text-gray-900">
              {getPageTitle()}
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