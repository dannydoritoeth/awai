'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface HistoryItem {
  id: string;
  title: string;
  timestamp: string;
  path: string;
}

const STORAGE_KEYS = {
  MENU_OPEN: 'hr_copilot_menu_open',
  ROLES_EXPANDED: 'hr_copilot_roles_expanded',
  CANDIDATES_EXPANDED: 'hr_copilot_candidates_expanded',
  RECENT_ROLES: 'hr_copilot_recent_roles',
  RECENT_CANDIDATES: 'hr_copilot_recent_candidates',
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

export default function Sidebar({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize with default values
  const [isClient, setIsClient] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [showRoles, setShowRoles] = useState(true);
  const [showCandidates, setShowCandidates] = useState(true);
  const [recentRoles, setRecentRoles] = useState<HistoryItem[]>([]);
  const [recentCandidates, setRecentCandidates] = useState<HistoryItem[]>([]);
  const pathname = usePathname();

  // Set up client-side rendering flag
  useEffect(() => {
    setIsClient(true);
    // Load initial values from localStorage
    setIsMenuOpen(getStoredValue(STORAGE_KEYS.MENU_OPEN, true));
    setShowRoles(getStoredValue(STORAGE_KEYS.ROLES_EXPANDED, true));
    setShowCandidates(getStoredValue(STORAGE_KEYS.CANDIDATES_EXPANDED, true));
    setRecentRoles(getStoredValue(STORAGE_KEYS.RECENT_ROLES, []));
    setRecentCandidates(getStoredValue(STORAGE_KEYS.RECENT_CANDIDATES, []));
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (!isClient) return;
    
    localStorage.setItem(STORAGE_KEYS.MENU_OPEN, JSON.stringify(isMenuOpen));
    localStorage.setItem(STORAGE_KEYS.ROLES_EXPANDED, JSON.stringify(showRoles));
    localStorage.setItem(STORAGE_KEYS.CANDIDATES_EXPANDED, JSON.stringify(showCandidates));
    localStorage.setItem(STORAGE_KEYS.RECENT_ROLES, JSON.stringify(recentRoles));
    localStorage.setItem(STORAGE_KEYS.RECENT_CANDIDATES, JSON.stringify(recentCandidates));
  }, [isClient, isMenuOpen, showRoles, showCandidates, recentRoles, recentCandidates]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div 
        className={`fixed top-0 left-0 h-full bg-gray-900 text-gray-100 transition-all duration-300 z-50
          ${isMenuOpen ? 'w-64' : 'w-0'}`}
      >
        <div className="flex flex-col h-full">
          {/* Top Bar with Menu Toggle and Add Button */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-4 hover:bg-gray-800 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <button
              onClick={() => {/* Add functionality here */}}
              className={`p-4 hover:bg-gray-800 transition-colors ${isMenuOpen ? 'block' : 'hidden'}`}
            >
              <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* History Lists */}
          <div className="flex-1 overflow-y-auto">
            {/* Recent Roles */}
            <div className="px-4 py-2">
              <button
                onClick={() => setShowRoles(!showRoles)}
                className="flex items-center justify-between w-full px-2 py-2 text-sm text-gray-300 hover:text-white"
              >
                <span>Recent Roles</span>
                <svg
                  className={`w-4 h-4 transition-transform ${showRoles ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showRoles && isClient && (
                <div className="mt-1 space-y-1">
                  {recentRoles.map((role) => (
                    <Link
                      key={role.id}
                      href={role.path}
                      className="flex items-center px-4 py-2 text-sm rounded-lg hover:bg-gray-700"
                    >
                      <span className="truncate">{role.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Candidates */}
            <div className="px-4 py-2">
              <button
                onClick={() => setShowCandidates(!showCandidates)}
                className="flex items-center justify-between w-full px-2 py-2 text-sm text-gray-300 hover:text-white"
              >
                <span>Recent Candidates</span>
                <svg
                  className={`w-4 h-4 transition-transform ${showCandidates ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showCandidates && isClient && (
                <div className="mt-1 space-y-1">
                  {recentCandidates.map((candidate) => (
                    <Link
                      key={candidate.id}
                      href={candidate.path}
                      className="flex items-center px-4 py-2 text-sm rounded-lg hover:bg-gray-700"
                    >
                      <span className="truncate">{candidate.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className={`flex-1 transition-all duration-300 ${isMenuOpen ? 'ml-64' : 'ml-0'}`}
      >
        {/* Top Bar */}
        <div className="sticky top-0 z-40 flex items-center h-16 bg-white border-b border-gray-200">
          <div className={`flex items-center ${isMenuOpen ? 'pl-4' : 'pl-20'}`}>
            <div className="text-lg font-semibold text-gray-900">
              {pathname.includes('role-finder') ? 'Role Finder' : 'Candidate Finder'}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="p-4">
          {children}
        </main>
      </div>
    </div>
  );
} 