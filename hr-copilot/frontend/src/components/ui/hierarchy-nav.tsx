import { useState, useMemo } from 'react';
import { Button } from './button';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { type Company } from '@/lib/services/companies';
import { useRouter } from 'next/navigation';

interface HierarchyNavProps {
  companies: Company[];
}

export function HierarchyNav({ companies }: HierarchyNavProps) {
  const router = useRouter();

  const [currentLevel, setCurrentLevel] = useState<'institution' | 'parent_org' | 'org'>('institution');
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [selectedParentOrg, setSelectedParentOrg] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ level: string; name: string }>>([]);

  // Group companies by institution and parent organization
  const hierarchy = useMemo(() => {
    const institutions = new Map<string, { 
      id: string; 
      name: string; 
      parentOrgs: Map<string, { 
        id: string; 
        name: string; 
        orgs: Company[] 
      }> 
    }>();

    // Create a "No Institution" entry
    const NO_INSTITUTION_ID = 'no-institution';
    institutions.set(NO_INSTITUTION_ID, {
      id: NO_INSTITUTION_ID,
      name: 'Other Organizations',
      parentOrgs: new Map()
    });

    companies.forEach(company => {
      const institution = company.institution;
      const parentOrgId = company.parent_company_id || 'no-parent';

      // Determine which institution to use
      const targetInstitution = institution 
        ? institutions.has(institution.id)
          ? institutions.get(institution.id)!
          : (() => {
              const newInst = {
                id: institution.id,
                name: institution.name,
                parentOrgs: new Map()
              };
              institutions.set(institution.id, newInst);
              return newInst;
            })()
        : institutions.get(NO_INSTITUTION_ID)!;

      // Add parent org if it doesn't exist
      if (!targetInstitution.parentOrgs.has(parentOrgId)) {
        targetInstitution.parentOrgs.set(parentOrgId, {
          id: parentOrgId,
          name: parentOrgId === 'no-parent' ? 'Direct Organizations' : company.name,
          orgs: []
        });
      }

      // Add company to parent org
      if (parentOrgId === 'no-parent') {
        targetInstitution.parentOrgs.get(parentOrgId)!.orgs.push(company);
      }
    });

    // Remove "No Institution" if it has no parent orgs
    if (institutions.get(NO_INSTITUTION_ID)?.parentOrgs.size === 0) {
      institutions.delete(NO_INSTITUTION_ID);
    }

    return institutions;
  }, [companies]);

  const handleBack = () => {
    if (currentLevel === 'org') {
      // Going back to parent org view
      const parentOrg = currentParentOrg;
      if (parentOrg) {
        router.push(`/companies/${parentOrg}`);
      }
      setCurrentLevel('parent_org');
      setSelectedParentOrg(null);
      setHistory(prev => prev.slice(0, -1));
    } else if (currentLevel === 'parent_org') {
      // Going back to institution view
      const institution = currentInstitution;
      if (institution && institution.id !== 'no-institution') {
        router.push(`/institutions/${institution.id}`);
      }
      setCurrentLevel('institution');
      setSelectedInstitution(null);
      setSelectedParentOrg(null);
      setHistory(prev => prev.slice(0, -1));
    }
  };

  const handleSelect = (id: string, name: string, level: 'institution' | 'parent_org' | 'org') => {
    if (level === 'institution') {
      if (id === 'no-institution') {
        setSelectedInstitution(id);
        setCurrentLevel('parent_org');
        setHistory(prev => [...prev, { level: 'institution', name }]);
      } else {
        router.push(`/institutions/${id}`);
        setSelectedInstitution(id);
        setCurrentLevel('parent_org');
        setHistory(prev => [...prev, { level: 'institution', name }]);
      }
    } else if (level === 'parent_org') {
      if (id !== 'no-parent') {
        router.push(`/companies/${id}`);
      }
      setSelectedParentOrg(id);
      setCurrentLevel('org');
      setHistory(prev => [...prev, { level: 'parent_org', name }]);
    } else {
      router.push(`/companies/${id}`);
    }
  };

  const currentInstitution = selectedInstitution ? hierarchy.get(selectedInstitution) : null;
  const currentParentOrg = currentInstitution && selectedParentOrg ? currentInstitution.parentOrgs.get(selectedParentOrg) : null;

  return (
    <div className="space-y-2">
      {/* Navigation Header */}
      {currentLevel !== 'institution' && (
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="default"
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

      {currentLevel === 'parent_org' && currentInstitution && (
        <>
          {/* Show parent orgs */}
          {Array.from(currentInstitution.parentOrgs.values()).map(parentOrg => (
            <button
              key={parentOrg.id}
              onClick={() => handleSelect(parentOrg.id, parentOrg.name, 'parent_org')}
              className="flex items-center justify-between w-full text-left px-2 py-1 rounded-sm hover:bg-gray-100"
            >
              <span className="text-[14px] leading-[20px] text-gray-700">
                {parentOrg.name}
              </span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          ))}
        </>
      )}

      {currentLevel === 'org' && currentParentOrg && (
        <>
          {/* Show orgs */}
          {currentParentOrg.orgs.map(org => (
            <button
              key={org.id}
              onClick={() => handleSelect(org.id, org.name, 'org')}
              className="flex items-center justify-between w-full text-left px-2 py-1 rounded-sm hover:bg-gray-100"
            >
              <span className="text-[14px] leading-[20px] text-gray-700">
                {org.name}
              </span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          ))}
        </>
      )}
    </div>
  );
} 