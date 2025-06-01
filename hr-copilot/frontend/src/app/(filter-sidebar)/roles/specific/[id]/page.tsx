'use client';

import { useState, useEffect, use } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getRole } from '@/lib/services/data';
import Link from 'next/link';
import type { Role, Capability, Skill } from '@/lib/services/data';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface SpecificRoleResponse {
  role: Role;
  capabilities?: Capability[];
  skills?: Skill[];
}

export default function SpecificRolePage(props: PageProps) {
  const params = use(props.params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<SpecificRoleResponse | null>(null);

  useEffect(() => {
    const loadRole = async () => {
      try {
        const response = await getRole(params.id);

        if (response.success && response.data) {
          setRole(response.data as SpecificRoleResponse);
        } else {
          setError(response.error || 'Failed to load role');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load role data';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadRole();
  }, [params.id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!role) {
    return <div>Role not found</div>;
  }

  return (
    <div className="container mx-auto py-8">
      {/* Role Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{role.role.title}</h1>
            <div className="text-gray-600">
              <p>{role.role.division.name} • {role.role.division.cluster} • {role.role.division.agency}</p>
              {role.role.grade_band && <p>Grade Band: {role.role.grade_band}</p>}
              {role.role.location && <p>Location: {role.role.location}</p>}
            </div>
          </div>
          <Link
            href={`/roles/general/${role.role.id}`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            View General Role
          </Link>
        </div>
      </div>

      {/* Role Details */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Role Details</h2>
            {role.role.primary_purpose && (
              <div className="mb-4">
                <h3 className="font-medium mb-2">Primary Purpose</h3>
                <p className="text-gray-600">{role.role.primary_purpose}</p>
              </div>
            )}
            {role.role.reporting_line && (
              <div className="mb-4">
                <h3 className="font-medium mb-2">Reporting Line</h3>
                <p className="text-gray-600">{role.role.reporting_line}</p>
              </div>
            )}
            {role.role.direct_reports && (
              <div className="mb-4">
                <h3 className="font-medium mb-2">Direct Reports</h3>
                <p className="text-gray-600">{role.role.direct_reports}</p>
              </div>
            )}
            {role.role.budget_responsibility && (
              <div>
                <h3 className="font-medium mb-2">Budget Responsibility</h3>
                <p className="text-gray-600">{role.role.budget_responsibility}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Capabilities */}
      {role.capabilities && role.capabilities.length > 0 && (
        <div className="mb-8">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Required Capabilities</h2>
              <div className="space-y-4">
                {role.capabilities.map((capability) => (
                  <div key={capability.id} className="p-4 bg-gray-50 rounded-lg">
                    <Link 
                      href={`/capabilities/${capability.id}`}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      {capability.name}
                    </Link>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-gray-600">{capability.group_name}</span>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        Level: {capability.level}
                      </span>
                    </div>
                    {capability.description && (
                      <p className="text-sm text-gray-600 mt-2">{capability.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Skills */}
      {role.skills && role.skills.length > 0 && (
        <div className="mb-8">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Required Skills</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {role.skills.map((skill) => (
                  <div key={skill.id} className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold">{skill.name}</h3>
                    <p className="text-sm text-gray-600">{skill.category}</p>
                    {skill.description && (
                      <p className="text-sm text-gray-600 mt-2">{skill.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Additional Information */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">Additional Information</h2>
          {role.role.anzsco_code && (
            <div className="mb-4">
              <h3 className="font-medium mb-2">ANZSCO Code</h3>
              <p className="text-gray-600">{role.role.anzsco_code}</p>
            </div>
          )}
          {role.role.pcat_code && (
            <div className="mb-4">
              <h3 className="font-medium mb-2">PCAT Code</h3>
              <p className="text-gray-600">{role.role.pcat_code}</p>
            </div>
          )}
          {role.role.date_approved && (
            <div className="mb-4">
              <h3 className="font-medium mb-2">Date Approved</h3>
              <p className="text-gray-600">{new Date(role.role.date_approved).toLocaleDateString()}</p>
            </div>
          )}
          {role.role.source_document_url && (
            <div>
              <h3 className="font-medium mb-2">Source Document</h3>
              <a 
                href={role.role.source_document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View Document
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 