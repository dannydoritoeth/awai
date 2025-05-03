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
        <div>
          <ResultsView roleData={roleData} />
        </div>
      )}
    </div>
  );
} 