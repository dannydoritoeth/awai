'use client';

import { useState, useEffect, use } from 'react';
import { getSkill } from '@/lib/services/skills';
import { useFilterStore } from '@/lib/stores/filter-store';
import SkillAIInsights from '@/app/components/SkillAIInsights';
import SkillInfoPanel from '@/app/components/SkillInfoPanel';
import type { Skill } from '@/lib/services/skills';

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
  const setFilters = useFilterStore(state => state.setFilters);

  useEffect(() => {
    async function loadSkill() {
      try {
        setLoading(true);
        const data = await getSkill(params.id);
        setSkill(data);
        // Set the skill filter
        setFilters({
          skill: params.id
        });
      } catch (error) {
        console.error('Error loading skill:', error);
        setError(error instanceof Error ? error.message : 'Failed to load skill');
      } finally {
        setLoading(false);
      }
    }
    loadSkill();

    // Clear the filter when unmounting
    return () => {
      setFilters({
        skill: undefined
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

  if (!skill) {
    return <div className="text-gray-900">Skill not found</div>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Main Content Area */}
      <div className="flex-1 p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{skill.name}</h1>
          <div className="mt-2 flex gap-2">
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
              {skill.category}
            </span>
            {skill.is_occupation_specific !== undefined && (
              <span className={`px-2 py-1 rounded text-sm ${
                skill.is_occupation_specific 
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {skill.is_occupation_specific ? 'Occupation Specific' : 'General'}
              </span>
            )}
          </div>
        </div>

        {/* AI Insights */}
        <SkillAIInsights 
          skillId={skill.id} 
          skillName={skill.name}
        />

        {/* Related Roles Section - Placeholder for now */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Related Roles</h2>
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No roles found</h3>
            <p className="text-gray-600">This skill is not currently linked to any roles.</p>
          </div>
        </div>
      </div>

      {/* Right Info Panel */}
      <div className="w-80 flex-shrink-0 p-8">
        <SkillInfoPanel skill={skill} />
      </div>
    </div>
  );
} 