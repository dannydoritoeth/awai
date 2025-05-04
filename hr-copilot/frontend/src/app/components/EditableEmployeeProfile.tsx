'use client';

import { useState } from 'react';

interface Employee {
  id: string;
  name: string;
  currentRole: string;
  department: string;
  pageUpId?: string;
}

interface EditableEmployeeProfileProps {
  employee: Employee;
  onContextUpdate: (context: string) => void;
}

export default function EditableEmployeeProfile({ 
  employee,
  onContextUpdate
}: EditableEmployeeProfileProps) {
  const [additionalContext, setAdditionalContext] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleContextChange = (newContext: string) => {
    setAdditionalContext(newContext);
    onContextUpdate(newContext);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
      {/* Employee Basic Info */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
          <span className="text-blue-600 font-semibold text-xl">
            {employee.name.split(' ').map(n => n[0]).join('')}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {employee.name}
          </h2>
          <p className="text-base text-gray-600 mt-1">
            {employee.currentRole} • {employee.department}
          </p>
          {employee.pageUpId && (
            <p className="text-sm text-gray-500 mt-1">
              PageUp ID: {employee.pageUpId}
            </p>
          )}
        </div>
      </div>

      {/* Additional Context Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Additional Context</h3>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
        </div>
        
        {isEditing ? (
          <textarea
            value={additionalContext}
            onChange={(e) => handleContextChange(e.target.value)}
            placeholder="Add any additional context about the employee that might be helpful for the AI (e.g., career goals, specific experiences, preferences)..."
            className="w-full rounded-lg border-none focus:ring-0 bg-gray-50 text-gray-900 placeholder:text-gray-500 text-sm py-3 px-4 resize-none min-h-[128px] max-h-[256px]"
          />
        ) : (
          <div className="bg-gray-50 rounded-lg p-4">
            {additionalContext ? (
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{additionalContext}</p>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No additional context provided. Click &apos;Edit&apos; to add information about career goals, specific experiences, or preferences.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 