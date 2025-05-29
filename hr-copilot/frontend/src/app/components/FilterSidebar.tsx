'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import RoleFilters from './RoleFilters';
import type { Filters } from './RoleFilters';

const STORAGE_KEYS = {
  FILTER_MENU_OPEN: 'hr_copilot_filter_menu_open',
};

function getStoredValue<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return defaultValue;
  }
}

interface FilterSidebarProps {
  children: React.ReactNode;
}

export default function FilterSidebar({ children }: FilterSidebarProps) {
  const [isClient, setIsClient] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const pathname = usePathname();

  // Extract taxonomy ID from pathname if we're on a taxonomy detail page
  const taxonomyId = pathname.match(/\/taxonomies\/([^\/]+)/)?.[1];

  useEffect(() => {
    setIsClient(true);
    setIsMenuOpen(getStoredValue(STORAGE_KEYS.FILTER_MENU_OPEN, true));
  }, []);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(STORAGE_KEYS.FILTER_MENU_OPEN, JSON.stringify(isMenuOpen));
  }, [isClient, isMenuOpen]);

  const handleFilterChange = (filters: Filters) => {
    console.log('Filters changed:', filters);
    // TODO: Implement filter handling
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
            <p>&nbsp;</p>
          </div>

          {/* Filters */}
          <div className="flex-1 overflow-y-auto p-6">
            <RoleFilters 
              onFilterChange={handleFilterChange}
              selectedTaxonomyId={taxonomyId}
            />
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