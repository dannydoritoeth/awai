'use client';

import { useState } from 'react';

interface Employee {
  id: string;
  name: string;
  currentRole: string;
  department: string;
  pageUpId?: string;
}

interface EmployeeFinderProps {
  onEmployeeSelect: (employee: Employee) => void;
}

export default function EmployeeFinder({ onEmployeeSelect }: EmployeeFinderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMethod, setSearchMethod] = useState<'search' | 'pageup'>('search');
  const [pageUpId, setPageUpId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Employee[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // TODO: Integrate with actual API
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock results
      const mockResults: Employee[] = [
        {
          id: '1',
          name: 'John Smith',
          currentRole: 'Software Engineer',
          department: 'Engineering',
          pageUpId: 'PU123'
        },
        {
          id: '2',
          name: 'Sarah Johnson',
          currentRole: 'Product Manager',
          department: 'Product',
          pageUpId: 'PU124'
        }
      ];
      
      setSearchResults(mockResults);
    } catch (error) {
      console.error('Error searching employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
      {/* Search Method Toggle */}
      <div className="flex space-x-4 bg-gray-50 p-1 rounded-lg">
        <button
          onClick={() => setSearchMethod('search')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors
            ${searchMethod === 'search'
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-gray-600 hover:text-gray-900'}`}
        >
          Search Directory
        </button>
        <button
          onClick={() => setSearchMethod('pageup')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors
            ${searchMethod === 'pageup'
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-gray-600 hover:text-gray-900'}`}
        >
          PageUp ID
        </button>
      </div>

      {/* Search Forms */}
      {searchMethod === 'search' ? (
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, role, or department..."
                className="w-full rounded-lg border-none focus:ring-0 bg-gray-50 py-3 pl-10 pr-4 text-gray-900 placeholder:text-gray-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <input
              type="text"
              value={pageUpId}
              onChange={(e) => setPageUpId(e.target.value)}
              placeholder="Enter PageUp ID..."
              className="w-full rounded-lg border-none focus:ring-0 bg-gray-50 py-3 px-4 text-gray-900 placeholder:text-gray-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Find Employee
          </button>
        </form>
      )}

      {/* Search Results */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-2">
          {searchResults.map((employee) => (
            <button
              key={employee.id}
              onClick={() => onEmployeeSelect(employee)}
              className="w-full p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{employee.name}</h3>
                  <p className="text-sm text-gray-600">{employee.currentRole}</p>
                  <p className="text-xs text-gray-500">{employee.department}</p>
                </div>
                {employee.pageUpId && (
                  <span className="text-xs text-gray-500">ID: {employee.pageUpId}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 