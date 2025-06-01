import { useState, useMemo } from 'react';
import { Button } from './button';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { type Division } from '@/lib/services/divisions';
import { useRouter } from 'next/navigation';

interface HierarchyNavProps {
  divisions: Division[];
}

export function HierarchyNav({ divisions }: HierarchyNavProps) {
  const router = useRouter();
  console.log('HierarchyNav rendered with divisions:', divisions);

  const [currentLevel, setCurrentLevel] = useState<'institution' | 'company' | 'division'>('institution');
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ level: string; name: string }>>([]);

  // Group divisions by institution and company
  const hierarchy = useMemo(() => {
    console.log('Building hierarchy from divisions:', divisions);
    const institutions = new Map<string, { id: string; name: string; companies: Map<string, { id: string; name: string; divisions: Division[] }> }>();

    // Create a "No Institution" entry
    const NO_INSTITUTION_ID = 'no-institution';
    institutions.set(NO_INSTITUTION_ID, {
      id: NO_INSTITUTION_ID,
      name: 'Other Companies',
      companies: new Map()
    });

    divisions.forEach(division => {
      console.log('Processing division:', division);
      if (!division.company) {
        console.warn('Division missing company:', division);
        return;
      }

      const company = division.company;
      const institution = company.institution;

      // Determine which institution to use
      const targetInstitution = institution 
        ? institutions.has(institution.id)
          ? institutions.get(institution.id)!
          : (() => {
              console.log('Creating new institution:', institution);
              const newInst = {
                id: institution.id,
                name: institution.name,
                companies: new Map()
              };
              institutions.set(institution.id, newInst);
              return newInst;
            })()
        : institutions.get(NO_INSTITUTION_ID)!;

      // Add company if it doesn't exist
      if (!targetInstitution.companies.has(company.id)) {
        console.log('Adding company to institution:', company);
        targetInstitution.companies.set(company.id, {
          id: company.id,
          name: company.name,
          divisions: []
        });
      }

      targetInstitution.companies.get(company.id)!.divisions.push(division);
    });

    // Remove "No Institution" if it has no companies
    if (institutions.get(NO_INSTITUTION_ID)?.companies.size === 0) {
      institutions.delete(NO_INSTITUTION_ID);
    }

    console.log('Final hierarchy:', Object.fromEntries(institutions));
    return institutions;
  }, [divisions]);

  const handleBack = () => {
    console.log('Navigating back from level:', currentLevel);
    
    if (currentLevel === 'division') {
      // Going back to company view
      const company = currentCompany;
      if (company) {
        router.push(`/companies/${company.id}`);
      }
      setCurrentLevel('company');
      setSelectedCompany(null);
      setHistory(prev => prev.slice(0, -1));
    } else if (currentLevel === 'company') {
      // Going back to institution view
      const institution = currentInstitution;
      if (institution && institution.id !== 'no-institution') {
        router.push(`/institutions/${institution.id}`);
      }
      setCurrentLevel('institution');
      setSelectedInstitution(null);
      setSelectedCompany(null);
      setHistory(prev => prev.slice(0, -1));
    }
  };

  const handleSelect = (id: string, name: string, level: 'institution' | 'company' | 'division') => {
    console.log('Selected item:', { id, name, level });
    if (level === 'institution') {
      if (id === 'no-institution') {
        // Just expand the view for "Other Companies"
        setSelectedInstitution(id);
        setCurrentLevel('company');
        setHistory(prev => [...prev, { level: 'institution', name }]);
      } else {
        // Navigate to institution page and expand view
        router.push(`/institutions/${id}`);
        setSelectedInstitution(id);
        setCurrentLevel('company');
        setHistory(prev => [...prev, { level: 'institution', name }]);
      }
    } else if (level === 'company') {
      // Navigate to company page and expand view
      router.push(`/companies/${id}`);
      setSelectedCompany(id);
      setCurrentLevel('division');
      setHistory(prev => [...prev, { level: 'company', name }]);
    } else {
      // Navigate to division detail page
      router.push(`/divisions/${id}`);
    }
  };

  const currentInstitution = selectedInstitution ? hierarchy.get(selectedInstitution) : null;
  const currentCompany = currentInstitution && selectedCompany ? currentInstitution.companies.get(selectedCompany) : null;

  console.log('Current view state:', {
    currentLevel,
    selectedInstitution,
    selectedCompany,
    history,
    institutionsCount: hierarchy.size,
    currentInstitutionCompaniesCount: currentInstitution?.companies.size,
    currentCompanyDivisionsCount: currentCompany?.divisions.length
  });

  return (
    <div className="space-y-2">
      {/* Navigation Header */}
      {currentLevel !== 'institution' && (
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="link"
            className="text-[14px] text-blue-600 hover:text-blue-800 p-0 h-auto"
            onClick={handleBack}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-[14px] text-gray-600">
            {history[history.length - 1]?.name}
          </span>
        </div>
      )}

      {/* List */}
      <div className="space-y-1">
        {currentLevel === 'institution' && (
          <>
            {/* Show institutions */}
            {Array.from(hierarchy.values()).map(institution => (
              <button
                key={institution.id}
                onClick={() => handleSelect(institution.id, institution.name, 'institution')}
                className="flex items-center justify-between w-full text-left px-2 py-1 rounded-sm hover:bg-gray-100"
              >
                <span className="text-[14px] leading-[20px] text-gray-700">
                  {institution.name}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            ))}
          </>
        )}

        {currentLevel === 'company' && currentInstitution && (
          <>
            {/* Show companies */}
            {Array.from(currentInstitution.companies.values()).map(company => (
              <button
                key={company.id}
                onClick={() => handleSelect(company.id, company.name, 'company')}
                className="flex items-center justify-between w-full text-left px-2 py-1 rounded-sm hover:bg-gray-100"
              >
                <span className="text-[14px] leading-[20px] text-gray-700">
                  {company.name}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            ))}
          </>
        )}

        {currentLevel === 'division' && currentCompany && (
          <>
            {/* Show divisions */}
            {currentCompany.divisions.map(division => (
              <button
                key={division.id}
                onClick={() => handleSelect(division.id, division.name, 'division')}
                className="flex items-center justify-between w-full text-left px-2 py-1 rounded-sm hover:bg-gray-100"
              >
                <span className="text-[14px] leading-[20px] text-gray-700">
                  {division.name}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
} 