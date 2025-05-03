'use client';

import { useState } from 'react';
import RoleInputForm from './components/RoleInputForm';
import ResultsView from './components/ResultsView';

interface RoleData {
  jobTitle?: string;
  pageUpId?: string;
  description?: string;
  skills?: string;
  location?: string;
  employmentType?: string;
}

export default function CandidateFinder() {
  const [showResults, setShowResults] = useState(false);
  const [roleData, setRoleData] = useState<RoleData | null>(null);

  const handleFindCandidates = (data: RoleData) => {
    setRoleData(data);
    setShowResults(true);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm">
      {!showResults ? (
        <div className="p-8">
          <RoleInputForm onSubmit={handleFindCandidates} />
        </div>
      ) : (
        <div className="p-8">
          <div className="mb-6 border-b border-gray-100 pb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-blue-950">
                  {roleData?.jobTitle || roleData?.pageUpId || 'Selected Role'}
                </h2>
                <p className="text-base text-gray-600 mt-1">
                  {roleData?.location} • {roleData?.employmentType}
                </p>
              </div>
              <button
                onClick={() => setShowResults(false)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Edit Role →
              </button>
            </div>
            {roleData?.skills && (
              <div className="mt-4 flex flex-wrap gap-2">
                {roleData.skills.split(',').map((skill: string, index: number) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full font-medium"
                  >
                    {skill.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ResultsView roleData={roleData} />
        </div>
      )}
    </div>
  );
} 