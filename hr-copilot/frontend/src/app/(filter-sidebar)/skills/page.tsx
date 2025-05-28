'use client';

import { useEffect, useState } from 'react';
import { getSkills, type Skill } from '@/lib/services/skills';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSkills() {
      try {
        setLoading(true);
        const data = await getSkills();
        setSkills(data || []);
      } catch (err) {
        console.error('Error loading skills:', err);
        setError('Failed to load skills');
      } finally {
        setLoading(false);
      }
    }
    loadSkills();
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Skills</h1>
        <p className="text-gray-700">Loading skills...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Skills</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!skills?.length) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Skills</h1>
        <p className="text-gray-900">No skills found.</p>
      </div>
    );
  }

  // Group skills by category
  const groupedSkills = skills.reduce((acc: Record<string, Skill[]>, skill: Skill) => {
    const category = skill.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(skill);
    return acc;
  }, {});

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2 text-gray-900">Skills</h1>
      <p className="text-gray-700 mb-8">Find roles that match your skills or discover new skills to develop</p>
      
      {Object.entries(groupedSkills).map(([category, skills]) => (
        <div key={category} className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill) => (
              <Link key={skill.id} href={`/skills/${skill.id}`}>
                <Card className="p-4 hover:bg-gray-50 cursor-pointer">
                  <h3 className="font-medium text-gray-900">{skill.name}</h3>
                  {skill.description && (
                    <p className="text-gray-700 mt-2 text-sm">{skill.description}</p>
                  )}
                  {skill.is_occupation_specific && (
                    <span className="inline-block mt-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                      Occupation Specific
                    </span>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
} 