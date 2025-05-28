'use client';

import { useState, useEffect, use } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getRole, type RoleWithSkills } from '@/lib/services/roles';
import Link from 'next/link';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function RolePage(props: PageProps) {
  const params = use(props.params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<RoleWithSkills | null>(null);

  useEffect(() => {
    const loadRole = async () => {
      try {
        setLoading(true);
        const data = await getRole(params.id);
        setRole(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load role';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadRole();
  }, [params.id]);

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Loading role...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Error</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Not Found</h1>
        <p className="text-gray-900">Role not found.</p>
      </div>
    );
  }

  // Group skills by category
  const groupedSkills = role.skills.reduce((acc: Record<string, typeof role.skills>, skill) => {
    const category = skill.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(skill);
    return acc;
  }, {});

  return (
    <div className="container mx-auto py-8">
      {/* Role Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-gray-900">{role.title}</h1>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-gray-100 text-gray-900 rounded-full text-sm">
                {role.is_specific ? 'Specific Role' : 'General Role'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Role Description */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">About</h2>
            {role.description ? (
              <p className="text-gray-900">{role.description}</p>
            ) : (
              <p className="text-gray-700 italic">No description available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Required Skills */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">Required Skills</h2>
            {Object.entries(groupedSkills).map(([category, skills]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-xl font-medium mb-4 text-gray-900">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {skills.map((skill) => (
                    <Link key={skill.id} href={`/skills/${skill.id}`}>
                      <Card className="p-4 hover:bg-gray-50 cursor-pointer">
                        <h4 className="font-medium text-gray-900">{skill.name}</h4>
                        <div className="mt-2">
                          <span className="text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            Level {skill.required_level}
                          </span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {role.skills.length === 0 && (
              <p className="text-gray-700 italic">No skills defined for this role.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 