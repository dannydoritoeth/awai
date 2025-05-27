'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getRole, getRoleTransitions } from '@/lib/services/data';
import Link from 'next/link';
import type { Transition, Capability, Skill } from '@/lib/services/data';

interface PageProps {
  params: {
    id: string;
  };
}

interface SpecificRoleResponse {
  role: {
    id: string;
    title: string;
    description?: string | null;
    function_area?: string | null;
    grade_band?: string;
    primary_purpose?: string;
  };
  capabilities?: Capability[];
  skills?: Skill[];
}

interface GeneralRoleDetails {
  id: string;
  title: string;
  description?: string;
  function_area?: string;
  grade_band?: string;
  primary_purpose?: string;
  capabilities?: Array<{
    id: string;
    name: string;
    group_name: string;
    description?: string;
    type: string;
    level: string;
  }>;
  skills?: Array<{
    id: string;
    name: string;
    category: string;
    description?: string;
  }>;
  demandIndicators?: {
    hiringFrequency: number;
    openRoles: number;
    internalHires: number;
    externalHires: number;
  };
  usedBy?: {
    division: string;
    agency: string;
    roleCount: number;
  }[];
  developmentTips?: string[];
}

export default function GeneralRolePage({ params }: PageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<GeneralRoleDetails | null>(null);
  const [transitions, setTransitions] = useState<Transition[]>([]);

  useEffect(() => {
    const loadRoleData = async () => {
      try {
        const response = await getRole(params.id);
        const transitionsResponse = await getRoleTransitions({
          roleId: params.id,
          direction: 'from',
          includeRequirements: true
        });

        if (response.success && response.data) {
          const roleData = response.data as SpecificRoleResponse;
          // TODO: Replace with actual data service call
          const mockData: GeneralRoleDetails = {
            id: roleData.role.id,
            title: roleData.role.title,
            description: roleData.role.description || undefined,
            function_area: roleData.role.function_area || undefined,
            grade_band: roleData.role.grade_band,
            primary_purpose: roleData.role.primary_purpose,
            capabilities: roleData.capabilities?.map((cap: Capability) => ({
              id: cap.id,
              name: cap.name,
              group_name: cap.group_name,
              description: cap.description || undefined,
              type: cap.type,
              level: cap.level
            })),
            skills: roleData.skills?.map((skill: Skill) => ({
              id: skill.id,
              name: skill.name,
              category: skill.category,
              description: skill.description || undefined
            })),
            demandIndicators: {
              hiringFrequency: 24,
              openRoles: 5,
              internalHires: 15,
              externalHires: 9
            },
            usedBy: [
              {
                division: "Digital Services",
                agency: "Department of Customer Service",
                roleCount: 12
              },
              {
                division: "Technology Solutions",
                agency: "Transport for NSW",
                roleCount: 8
              },
              {
                division: "Digital Transformation",
                agency: "Department of Education",
                roleCount: 5
              }
            ],
            developmentTips: [
              "Focus on developing leadership capabilities through mentoring programs",
              "Gain experience in cross-functional project management",
              "Build expertise in emerging technologies relevant to the role",
              "Develop strong stakeholder management skills"
            ]
          };
          setRole(mockData);
          
          if (transitionsResponse.success && transitionsResponse.data) {
            setTransitions(transitionsResponse.data.transitions);
          }
        } else {
          setError(response.error || 'Failed to load role details');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load role data';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadRoleData();
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
      {/* Header Summary */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{role.title}</h1>
        <div className="flex gap-2 mb-4">
          {role.grade_band && (
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
              {role.grade_band}
            </span>
          )}
          {role.function_area && (
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
              {role.function_area}
            </span>
          )}
        </div>
        {role.primary_purpose && (
          <p className="text-gray-600 text-lg">{role.primary_purpose}</p>
        )}
      </div>

      {/* Capability Overview */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Required Capabilities</h2>
            <div className="space-y-4">
              {role.capabilities?.map((capability) => (
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

      {/* Required Skills */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Required Skills</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {role.skills?.map((skill) => (
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

      {/* Transitions */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Career Transitions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-semibold mb-4">Common Next Roles</h3>
                <div className="space-y-4">
                  {transitions.slice(0, 3).map((transition) => (
                    <Link
                      key={transition.id}
                      href={`/transitions/${role.id}-${transition.to_role.id}`}
                      className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{transition.to_role.title}</h4>
                          <p className="text-sm text-gray-600">{transition.to_role.division.name}</p>
                        </div>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                          {Math.round(transition.success_rate * 100)}% success
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4">Pivot Opportunities</h3>
                <div className="space-y-4">
                  {transitions.slice(3, 6).map((transition) => (
                    <Link
                      key={transition.id}
                      href={`/transitions/${role.id}-${transition.to_role.id}`}
                      className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{transition.to_role.title}</h4>
                          <p className="text-sm text-gray-600">{transition.to_role.division.name}</p>
                        </div>
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                          {transition.transition_type.name}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Used By */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Agencies Using This Role</h2>
            <div className="space-y-4">
              {role.usedBy?.map((usage, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{usage.agency}</h3>
                      <p className="text-sm text-gray-600">{usage.division}</p>
                    </div>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                      {usage.roleCount} positions
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demand Indicators */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Demand Indicators</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm text-gray-600">Annual Hiring</h3>
                <p className="text-2xl font-semibold">{role.demandIndicators?.hiringFrequency}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm text-gray-600">Open Roles</h3>
                <p className="text-2xl font-semibold">{role.demandIndicators?.openRoles}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm text-gray-600">Internal Hires</h3>
                <p className="text-2xl font-semibold">{role.demandIndicators?.internalHires}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm text-gray-600">External Hires</h3>
                <p className="text-2xl font-semibold">{role.demandIndicators?.externalHires}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Development Tips */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Development Tips</h2>
          <div className="space-y-3">
            {role.developmentTips?.map((tip, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="text-blue-500 mt-1">•</span>
                <p className="text-gray-700">{tip}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 