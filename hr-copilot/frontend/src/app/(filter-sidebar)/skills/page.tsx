'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getSkills } from '@/lib/services/data';
import Link from 'next/link';
import type { Skill } from '@/lib/services/data';

export default function SkillsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showOccupationSpecific, setShowOccupationSpecific] = useState<boolean | undefined>(
    undefined
  );

  useEffect(() => {
    const loadSkills = async () => {
      try {
        const response = await getSkills({
          searchTerm: searchTerm || undefined,
          categories: selectedCategory ? [selectedCategory] : undefined,
          isOccupationSpecific: showOccupationSpecific
        });

        if (response.success && response.data) {
          setSkills(response.data);
        } else {
          setError(response.error || 'Failed to load skills');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load skills';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadSkills();
  }, [searchTerm, selectedCategory, showOccupationSpecific]);

  const skillCategories = [
    'Technical',
    'Soft Skills',
    'Leadership',
    'Domain Knowledge',
    'Tools',
    'Methodologies'
  ];

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Skills</h1>
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Search skills..."
            className="flex-1 px-4 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="px-4 py-2 border rounded-lg"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {skillCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            className="px-4 py-2 border rounded-lg"
            value={showOccupationSpecific === undefined ? '' : showOccupationSpecific.toString()}
            onChange={(e) => {
              const value = e.target.value;
              setShowOccupationSpecific(
                value === '' ? undefined : value === 'true'
              );
            }}
          >
            <option value="">All Skills</option>
            <option value="true">Occupation Specific</option>
            <option value="false">General Skills</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skills.map((skill) => (
          <Link key={skill.id} href={`/skills/${skill.id}`}>
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-xl font-semibold">{skill.name}</h2>
                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                    {skill.category}
                  </span>
                </div>
                {skill.description && (
                  <p className="text-gray-600 line-clamp-3">{skill.description}</p>
                )}
                {skill.is_occupation_specific && (
                  <div className="mt-2">
                    <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      Occupation Specific
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
} 