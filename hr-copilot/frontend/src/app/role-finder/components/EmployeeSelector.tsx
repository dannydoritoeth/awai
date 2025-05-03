'use client';

import { useState } from 'react';

interface EmployeeData {
  id: string;
  name: string;
  currentRole: string;
  department: string;
  tenure: string;
  skills: string[];
  experience: {
    role: string;
    duration: string;
  }[];
  preferences?: {
    desiredRoles?: string[];
    locations?: string[];
    workStyle?: string[];
  };
}

interface EmployeeSelectorProps {
  onSelect: (employee: EmployeeData) => void;
}

export default function EmployeeSelector({ onSelect }: EmployeeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'search' | 'org'>('search');

  // Mock data - will be replaced with real data
  const employees: EmployeeData[] = [
    {
      id: '1',
      name: 'Alex Thompson',
      currentRole: 'Software Engineer',
      department: 'Engineering',
      tenure: '2 years',
      skills: ['JavaScript', 'React', 'Node.js', 'AWS'],
      experience: [
        { role: 'Junior Developer', duration: '1.5 years' }
      ],
      preferences: {
        desiredRoles: ['Senior Engineer', 'Tech Lead'],
        locations: ['Melbourne', 'Sydney'],
        workStyle: ['Hybrid', 'Remote']
      }
    },
    // More employees will be added here
  ];

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.currentRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex space-x-4 p-4 bg-gray-50 rounded-lg">
        <button
          onClick={() => setViewMode('search')}
          className={`flex-1 py-3 px-4 rounded-lg text-base font-medium transition-colors
            ${viewMode === 'search'
              ? 'bg-blue-600 text-white'
              : 'bg-transparent text-gray-800 hover:bg-gray-100'}`}
        >
          Search Directory
        </button>
        <button
          onClick={() => setViewMode('org')}
          className={`flex-1 py-3 px-4 rounded-lg text-base font-medium transition-colors
            ${viewMode === 'org'
              ? 'bg-blue-600 text-white'
              : 'bg-transparent text-gray-800 hover:bg-gray-100'}`}
        >
          Org Chart
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by name, role, or department..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 pl-10 py-3"
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

      {/* Employee List */}
      <div className="space-y-4">
        {filteredEmployees.map((employee) => (
          <button
            key={employee.id}
            className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-blue-200 hover:shadow-sm transition-all"
            onClick={() => onSelect(employee)}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-semibold text-lg">
                  {employee.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{employee.name}</h3>
                <p className="text-sm text-gray-600">
                  {employee.currentRole} • {employee.department}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {employee.skills.slice(0, 3).map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                >
                  {skill}
                </span>
              ))}
              {employee.skills.length > 3 && (
                <span className="px-2 py-1 text-gray-500 text-xs">
                  +{employee.skills.length - 3} more
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
} 