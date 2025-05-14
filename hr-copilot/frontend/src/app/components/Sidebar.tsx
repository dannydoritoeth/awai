'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChatSession, loadChatSessions } from '@/lib/supabase';
import { events, EVENT_NAMES } from '@/lib/events';

interface HistoryItem extends ChatSession {
  path: string;
}

type ItemType = 'roles' | 'candidates' | null;

const STORAGE_KEYS = {
  MENU_OPEN: 'hr_copilot_menu_open',
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

function groupItemsByDate(items: HistoryItem[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);

  return items.reduce((groups, item) => {
    const itemDate = new Date(item.created_at);
    if (itemDate >= today) {
      groups.today.push(item);
    } else if (itemDate >= yesterday) {
      groups.yesterday.push(item);
    } else if (itemDate >= weekAgo) {
      groups.week.push(item);
    } else if (itemDate >= monthAgo) {
      groups.month.push(item);
    }
    return groups;
  }, {
    today: [] as HistoryItem[],
    yesterday: [] as HistoryItem[],
    week: [] as HistoryItem[],
    month: [] as HistoryItem[]
  });
}

export default function Sidebar({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isClient, setIsClient] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [selectedType, setSelectedType] = useState<ItemType>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const sessions = await loadChatSessions();
      const items: HistoryItem[] = sessions.map(session => ({
        ...session,
        path: `/c/${session.id}` // Construct the path based on session ID
      }));
      setHistoryItems(items);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    setIsMenuOpen(getStoredValue(STORAGE_KEYS.MENU_OPEN, true));
    
    // Load initial sessions
    loadSessions();

    // Subscribe to session creation events
    const unsubscribe = events.subscribe(EVENT_NAMES.SESSION_CREATED, loadSessions);

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem(STORAGE_KEYS.MENU_OPEN, JSON.stringify(isMenuOpen));
  }, [isClient, isMenuOpen]);

  const filteredItems = selectedType 
    ? historyItems.filter(item => 
        selectedType === 'roles' ? item.mode === 'hiring' : item.mode === 'candidate'
      )
    : historyItems;
  
  const groupedItems = groupItemsByDate(filteredItems);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Menu Toggle Button - Moved outside sidebar */}
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
          ${isMenuOpen ? 'w-64' : 'w-0 overflow-hidden'}`}
      >
        <div className="flex flex-col h-full w-64">
          {/* Top Bar with Add Button */}
          <div className="flex justify-end items-center pt-4">
            <Link
              href="/"
              className={`p-4 hover:bg-gray-100 transition-colors ${isMenuOpen ? 'block' : 'hidden'}`}
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          </div>

          {/* Type Filter Pills - Only visible when menu is open */}
          <div className={`px-4 py-2 ${isMenuOpen ? 'block' : 'hidden'}`}>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedType(selectedType === 'roles' ? null : 'roles')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${selectedType === 'roles' 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
              >
                Roles
              </button>
              <button
                onClick={() => setSelectedType(selectedType === 'candidates' ? null : 'candidates')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${selectedType === 'candidates' 
                    ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
              >
                Profiles
              </button>
            </div>
          </div>

          {/* Items List Grouped by Date */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {isLoading ? (
              // Loading state
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* Today's Items */}
                {groupedItems.today.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-medium text-gray-500 mb-2">Today</h3>
                    <div className="space-y-1">
                      {groupedItems.today.map((item) => (
                        <Link
                          key={item.id}
                          href={`${item.path}?context=${item.mode === 'candidate' ? 'profile' : item.mode === 'hiring' ? 'role' : 'open'}`}
                          className={`block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors ${
                            pathname === item.path ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                          }`}
                        >
                          <div className="text-sm">{item.title}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Yesterday's Items */}
                {groupedItems.yesterday.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-medium text-gray-500 mb-2">Yesterday</h3>
                    <div className="space-y-1">
                      {groupedItems.yesterday.map((item) => (
                        <Link
                          key={item.id}
                          href={`${item.path}?context=${item.mode === 'candidate' ? 'profile' : item.mode === 'hiring' ? 'role' : 'open'}`}
                          className={`block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors ${
                            pathname === item.path ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                          }`}
                        >
                          <div className="text-sm">{item.title}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previous 7 Days */}
                {groupedItems.week.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-medium text-gray-500 mb-2">Previous 7 Days</h3>
                    <div className="space-y-1">
                      {groupedItems.week.map((item) => (
                        <Link
                          key={item.id}
                          href={`${item.path}?context=${item.mode === 'candidate' ? 'profile' : item.mode === 'hiring' ? 'role' : 'open'}`}
                          className={`block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors ${
                            pathname === item.path ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                          }`}
                        >
                          <div className="text-sm">{item.title}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previous 30 Days */}
                {groupedItems.month.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-medium text-gray-500 mb-2">Previous 30 Days</h3>
                    <div className="space-y-1">
                      {groupedItems.month.map((item) => (
                        <Link
                          key={item.id}
                          href={`${item.path}?context=${item.mode === 'candidate' ? 'profile' : item.mode === 'hiring' ? 'role' : 'open'}`}
                          className={`block w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors ${
                            pathname === item.path ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                          }`}
                        >
                          <div className="text-sm">{item.title}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* No items state */}
                {Object.values(groupedItems).every(group => group.length === 0) && (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No chat sessions found</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className={`flex-1 min-h-screen transition-all duration-300 bg-gray-50 ${isMenuOpen ? 'ml-64' : 'ml-0'}`}
      >
        {/* Top Bar */}
        <div className="sticky top-0 z-40 flex items-center h-16 bg-white border-b border-gray-200">
          <div className={`flex items-center ${isMenuOpen ? 'pl-4' : 'pl-20'}`}>
            <div className="text-lg font-semibold text-gray-900">
              {pathname.includes('/c/') ? 'TalentPathAI' : pathname.includes('role-finder') ? 'Role Finder' : 'TalentPathAI'}
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