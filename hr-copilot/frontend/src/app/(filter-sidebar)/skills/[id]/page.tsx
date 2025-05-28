'use client';

import { useState, useEffect, use } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getSkill } from '@/lib/services/data';
import type { Skill } from '@/lib/services/data';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function SkillPage(props: PageProps) {
  const params = use(props.params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skill, setSkill] = useState<Skill | null>(null);

  useEffect(() => {
    const loadSkill = async () => {
      try {
        const response = await getSkill(params.id);

        if (response.success && response.data) {
          setSkill(response.data);
        } else {
          setError(response.error || 'Failed to load skill');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load skill';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadSkill();
  }, [params.id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!skill) {
    return <div>Skill not found</div>;
  }

  return (
    <div className="container mx-auto py-8">
      {/* Skill Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">{skill.name}</h1>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {skill.category}
              </span>
              {skill.is_occupation_specific && (
                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                  Occupation Specific
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Skill Details */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">About</h2>
            {skill.description ? (
              <p className="text-gray-600">{skill.description}</p>
            ) : (
              <p className="text-gray-500 italic">No description available</p>
            )}
            {skill.source && (
              <p className="mt-4 text-sm text-gray-500">Source: {skill.source}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Related Roles */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Related Roles</h2>
            <div className="space-y-4">
              {/* TODO: Add related roles list when available */}
              <p className="text-gray-500 italic">Related roles will be displayed here</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Development Resources */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4">Development Resources</h2>
            <div className="space-y-4">
              {/* TODO: Add development resources when available */}
              <p className="text-gray-500 italic">Development resources will be displayed here</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Statistics */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Usage Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium mb-2">Total Roles</h3>
              <p className="text-3xl font-semibold text-blue-600">--</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium mb-2">Required Level</h3>
              <p className="text-3xl font-semibold text-blue-600">--</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium mb-2">Demand Trend</h3>
              <p className="text-3xl font-semibold text-blue-600">--</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 