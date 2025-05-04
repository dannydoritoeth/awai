'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import UnifiedResultsView from '../components/UnifiedResultsView';
import EmployeeFinder from '../components/EmployeeFinder';

interface Employee {
  id: string;
  name: string;
  currentRole: string;
  department: string;
  pageUpId?: string;
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = searchParams.get('context') as 'employee' | 'role' | 'open';
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
  };

  // If no context is provided, redirect to home
  if (!context) {
    router.push('/');
    return null;
  }

  // Show employee finder when context is employee and no employee is selected
  if (context === 'employee' && !selectedEmployee) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">Find Employee</h1>
            <p className="text-base text-gray-600">
              Search for an employee to start the conversation
            </p>
          </div>
          <EmployeeFinder onEmployeeSelect={handleEmployeeSelect} />
        </div>
      </div>
    );
  }

  // Show chat interface with employee data when employee is selected
  if (selectedEmployee) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <UnifiedResultsView
            employeeData={{
              name: selectedEmployee.name,
              currentRole: selectedEmployee.currentRole,
              department: selectedEmployee.department,
              tenure: "N/A",
              skills: []
            }}
            startContext="employee"
          />
        </div>
      </div>
    );
  }

  // Default view for other contexts (role or open)
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <UnifiedResultsView
          startContext={context}
        />
      </div>
    </div>
  );
} 