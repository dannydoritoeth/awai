import { Card, CardContent } from '@/components/ui/card';
import type { Skill } from '@/lib/services/skills';

interface SkillInfoPanelProps {
  skill: Skill;
}

export default function SkillInfoPanel({ skill }: SkillInfoPanelProps) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Category</h3>
              <p className="mt-1 text-gray-900">{skill.category}</p>
            </div>
            {skill.is_occupation_specific !== undefined && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Type</h3>
                <p className="mt-1 text-gray-900">
                  {skill.is_occupation_specific ? 'Occupation Specific' : 'General'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Skill Details */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Details</h2>
          <div className="space-y-4">
            {skill.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Description</h3>
                <p className="mt-1 text-gray-900">{skill.description}</p>
              </div>
            )}
            {skill.source && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Source</h3>
                <p className="mt-1 text-gray-900">{skill.source}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 