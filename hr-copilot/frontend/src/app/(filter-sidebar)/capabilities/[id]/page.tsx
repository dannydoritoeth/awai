'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { Capability } from '@/lib/services/capabilities';
import { useParams } from 'next/navigation';

interface Role {
  id: string;
  title: string;
  division: string;
}

interface CapabilityDetails extends Capability {
  roles?: Role[];
  relatedSkills?: string[];
  levelDefinitions?: {
    level: string;
    description: string;
    indicators: string[];
  }[];
}

export default function CapabilityPage() {
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capability, setCapability] = useState<CapabilityDetails | null>(null);

  useEffect(() => {
    const loadCapability = async () => {
      try {
        // TODO: Replace with actual API call once available
        const mockCapability: CapabilityDetails = {
          id: params.id as string,
          name: "Strategic Planning",
          group_name: "Leadership",
          description: "Ability to develop and execute organizational strategies",
          type: "Core",
          level: "Advanced",
          levelDefinitions: [
            {
              level: "Foundational",
              description: "Basic understanding of strategic planning concepts",
              indicators: [
                "Can participate in strategic planning sessions",
                "Understands basic strategic frameworks",
                "Can contribute to departmental planning"
              ]
            },
            {
              level: "Intermediate",
              description: "Can lead strategic planning for small teams",
              indicators: [
                "Develops team-level strategies",
                "Aligns team goals with organizational objectives",
                "Monitors and reports on strategic progress"
              ]
            },
            {
              level: "Advanced",
              description: "Leads strategic planning for large divisions",
              indicators: [
                "Sets organizational strategic direction",
                "Leads enterprise-wide strategic initiatives",
                "Innovates strategic planning approaches"
              ]
            }
          ],
          relatedSkills: [
            "Business Analysis",
            "Change Management",
            "Risk Assessment",
            "Stakeholder Management"
          ]
        };

        setCapability(mockCapability);
      } catch {
        setError('Failed to load capability');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      loadCapability();
    }
  }, [params.id]);

  if (loading) {
    return <div className="text-gray-900">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!capability) {
    return <div className="text-gray-900">Capability not found</div>;
  }

  return (
    <div className="container mx-auto py-8">
      {/* Capability Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-900">{capability.name}</h1>
        <div className="flex gap-2 mb-4">
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
            {capability.group_name}
          </span>
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
            {capability.type}
          </span>
        </div>
        <p className="text-gray-900 text-lg">{capability.description}</p>
      </div>

      {/* Level Definitions */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-6 text-gray-900">Level Definitions</h2>
            <div className="space-y-6">
              {capability.levelDefinitions?.map((level) => (
                <div key={level.level} className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-xl font-semibold mb-2 text-gray-900">{level.level}</h3>
                  <p className="text-gray-900 mb-4">{level.description}</p>
                  <div className="space-y-2">
                    {level.indicators.map((indicator, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <p className="text-gray-900">{indicator}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Related Skills */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">Related Skills</h2>
            <div className="flex flex-wrap gap-2">
              {capability.relatedSkills?.map((skill) => (
                <span 
                  key={skill} 
                  className="bg-gray-100 text-gray-900 px-3 py-1 rounded-full text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 