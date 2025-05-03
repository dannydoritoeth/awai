'use client';

import { useState } from 'react';
import EmployeeSelector from './components/EmployeeSelector';
import RoleResultsView from './components/RoleResultsView';

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

export default function RoleFinder() {
  const [showResults, setShowResults] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);

  const handleEmployeeSelect = (employee: EmployeeData) => {
    setSelectedEmployee(employee);
    setShowResults(true);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm">
      {!showResults ? (
        <div className="p-8">
          <EmployeeSelector onSelect={handleEmployeeSelect} />
        </div>
      ) : (
        <div className="p-8">
          <div className="mb-6 border-b border-gray-100 pb-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-xl">
                    {selectedEmployee?.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-blue-950">
                    {selectedEmployee?.name}
                  </h2>
                  <p className="text-base text-gray-600 mt-1">
                    {selectedEmployee?.currentRole} • {selectedEmployee?.department}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedEmployee?.tenure} tenure
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowResults(false)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Change Employee →
              </button>
            </div>
            {selectedEmployee?.skills && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Key Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedEmployee.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedEmployee?.preferences?.desiredRoles && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Career Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedEmployee.preferences.desiredRoles.map((role, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full font-medium"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <RoleResultsView employeeData={selectedEmployee} />
        </div>
      )}
    </div>
  );
} 