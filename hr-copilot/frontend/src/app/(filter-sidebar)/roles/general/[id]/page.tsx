'use client';

import { useState, useEffect, use } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getRole } from '@/lib/services/roles';
import { useFilterStore } from '@/lib/stores/filter-store';
import type { Role } from '@/lib/services/roles';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function GeneralRolePage(props: PageProps) {
  const params = use(props.params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const setFilters = useFilterStore(state => state.setFilters);

  useEffect(() => {
    async function loadRole() {
      try {
        setLoading(true);
        const data = await getRole(params.id, {
          includeSkills: true,
          includeCapabilities: true
        });
        setRole(data);
        // Set the role filter
        setFilters({
          generalRole: params.id
        });
      } catch (error) {
        console.error('Error loading role:', error);
        setError(error instanceof Error ? error.message : 'Failed to load role');
      } finally {
        setLoading(false);
      }
    }
    loadRole();

    // Clear the filter when unmounting
    return () => {
      setFilters({
        generalRole: undefined
      });
    };
  }, [params.id, setFilters]);

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-20 bg-gray-100 rounded-lg"></div>
      <div className="h-40 bg-gray-100 rounded-lg"></div>
    </div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!role) {
    return <div className="text-gray-900">Role not found</div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2 text-gray-900">{role.title}</h1>
        {role.description && (
          <p className="text-gray-600">{role.description}</p>
        )}
      </div>

      {/* Role Details */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Role Details</h2>
          {role.primary_purpose && (
            <div className="mb-4">
              <h3 className="font-medium mb-2">Primary Purpose</h3>
              <p className="text-gray-600">{role.primary_purpose}</p>
            </div>
          )}
          {role.reporting_line && (
            <div className="mb-4">
              <h3 className="font-medium mb-2">Reporting Line</h3>
              <p className="text-gray-600">{role.reporting_line}</p>
            </div>
          )}
          {role.direct_reports && (
            <div className="mb-4">
              <h3 className="font-medium mb-2">Direct Reports</h3>
              <p className="text-gray-600">{role.direct_reports}</p>
            </div>
          )}
          {role.budget_responsibility && (
            <div>
              <h3 className="font-medium mb-2">Budget Responsibility</h3>
              <p className="text-gray-600">{role.budget_responsibility}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Capabilities */}
      {role.capabilities && role.capabilities.length > 0 && (
        <div className="mb-8">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Required Capabilities</h2>
              <div className="space-y-4">
                {role.capabilities.map((capability) => (
                  <div key={capability.id} className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold">{capability.name}</h3>
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
    </div>
  );
} 