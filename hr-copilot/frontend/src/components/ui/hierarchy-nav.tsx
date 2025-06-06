import { useState, useMemo } from 'react';
import { Button } from './button';
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

    // First pass: Identify parent organizations
    const parentOrgs = new Map<string, Company>();
    companies.forEach(company => {
      if (!company.parent_company_id) {
        parentOrgs.set(company.id, company);
      }
    });

    // Second pass: Group companies by institution and parent org
    companies.forEach(company => {
      const institution = company.institution;
      const parentOrgId = company.parent_company_id;

      // Skip parent orgs in this pass
      if (!parentOrgId && parentOrgs.has(company.id)) {
        return;
      }

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
        : null;

      if (!targetInstitution) {
        return; // Skip if no institution
      }

      // Get the parent org
      const parentOrg = parentOrgId ? parentOrgs.get(parentOrgId) : null;
      const parentOrgMapId = parentOrg?.id || 'no-parent';

      // Add parent org if it doesn't exist
      if (!targetInstitution.parentOrgs.has(parentOrgMapId)) {
        targetInstitution.parentOrgs.set(parentOrgMapId, {
          id: parentOrgMapId,
          name: parentOrg ? parentOrg.name : 'Direct Organizations',
          orgs: []
        });
      }

      // Add company to parent org group
      targetInstitution.parentOrgs.get(parentOrgMapId)!.orgs.push(company);
    });

    return institutions;
  }, [companies]);

  const handleInstitutionClick = (id: string, name: string) => {
    router.push(`/institutions/${id}`);
    setSelectedInstitution(id);
    setCurrentLevel('parent_org');
    setHistory([{ level: 'institution', name }]);
  };

  const handleParentOrgClick = (id: string, name: string) => {
    router.push(`/companies/${id}`);
    setSelectedParentOrg(id);
    setCurrentLevel('org');
    setHistory(prev => [...prev, { level: 'parent_org', name }]);
  };

  const handleBack = () => {
    if (currentLevel === 'org') {
      const parentOrgId = selectedParentOrg;
      setCurrentLevel('parent_org');
      setSelectedParentOrg(null);
      setHistory(prev => prev.slice(0, -1));
      if (parentOrgId) {
        router.push(`/companies/${parentOrgId}`);
      }
    } else if (currentLevel === 'parent_org') {
      const institutionId = selectedInstitution;
      setCurrentLevel('institution');
      setSelectedInstitution(null);
      setHistory([]);
      if (institutionId) {
        router.push(`/institutions/${institutionId}`);
      }
    }
  };

  return (
    <div className="space-y-1">
      {/* Institution Level */}
      {currentLevel === 'institution' && Array.from(hierarchy.values()).map(institution => (
        <div key={institution.id}>
          <Button
            variant="default"
            className="w-full text-left text-[14px] text-gray-700 hover:text-gray-900 justify-between px-2 py-1 h-auto font-normal bg-transparent hover:bg-gray-100"
            onClick={() => handleInstitutionClick(institution.id, institution.name)}
          >
            {institution.name}
            <span className="text-gray-500">{'>'}</span>
          </Button>
        </div>
      ))}

      {/* Parent Org Level */}
      {currentLevel === 'parent_org' && selectedInstitution && (
        <>
          <div className="flex items-center gap-1 mb-2">
            <Button
              variant="default"
              className="text-[14px] text-gray-700 hover:text-gray-900 p-0 h-auto font-normal bg-transparent"
              onClick={handleBack}
            >
              {'< Back'}
            </Button>
            <span className="text-gray-500">/</span>
            <span className="text-[14px] text-gray-700">{history[0].name}</span>
          </div>
          {Array.from(hierarchy.get(selectedInstitution)?.parentOrgs.values() || []).map(parentOrg => (
            <Button
              key={parentOrg.id}
              variant="default"
              className="w-full text-left text-[14px] text-gray-700 hover:text-gray-900 justify-between px-2 py-1 h-auto font-normal bg-transparent hover:bg-gray-100"
              onClick={() => handleParentOrgClick(parentOrg.id, parentOrg.name)}
            >
              <span className="pl-4">{parentOrg.name}</span>
              <span className="text-gray-500">{'>'}</span>
            </Button>
          ))}
        </>
      )}

      {/* Org Level */}
      {currentLevel === 'org' && selectedParentOrg && selectedInstitution && (
        <>
          <div className="flex items-center gap-1 mb-2">
            <Button
              variant="default"
              className="text-[14px] text-gray-700 hover:text-gray-900 p-0 h-auto font-normal bg-transparent"
              onClick={handleBack}
            >
              {'< Back'}
            </Button>
            <span className="text-gray-500">/</span>
            <span className="text-[14px] text-gray-700">{history[0].name}</span>
          </div>
          {hierarchy.get(selectedInstitution)?.parentOrgs.get(selectedParentOrg)?.orgs.map(org => (
            <Button
              key={org.id}
              variant="default"
              className="w-full text-left text-[14px] text-gray-700 hover:text-gray-900 px-2 py-1 h-auto font-normal bg-transparent hover:bg-gray-100"
              onClick={() => router.push(`/companies/${org.id}`)}
            >
              <span className="pl-8">{org.name}</span>
            </Button>
          ))}
        </>
      )}
    </div>
  );
} 