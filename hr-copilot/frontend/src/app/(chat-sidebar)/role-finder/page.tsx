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
        <div>
          <RoleResultsView employeeData={selectedEmployee} />
        </div>
      )}
    </div>
  );
} 