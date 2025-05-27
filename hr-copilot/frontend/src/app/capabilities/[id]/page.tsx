'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getRole } from '@/lib/services/data';
import Link from 'next/link';
import type { Capability, Role } from '@/lib/services/data';

interface PageProps {
  params: {
    id: string;
  };
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

export default function CapabilityPage({ params }: PageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capability, setCapability] = useState<CapabilityDetails | null>(null);

  useEffect(() => {
    const loadCapability = async () => {
      try {
        // TODO: Replace with actual capability service call when available
        const mockCapability: CapabilityDetails = {
          id: params.id,
          name: "Strategic Planning",
          group_name: "Leadership",
          description: "Ability to develop and execute organizational strategies",
          type: "Core",
          level: "Expert",
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
                "Creates division-wide strategic plans",
                "Integrates multiple team strategies",
                "Develops strategic measurement frameworks"
              ]
            },
            {
              level: "Expert",
              description: "Drives organization-wide strategy",
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
      } catch (error) {
        setError('Failed to load capability');
      } finally {
        setLoading(false);
      }
    };

    loadCapability();
  }, [params.id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!capability) {
    return <div>Capability not found</div>;
  }

  return (
    <div className="container mx-auto py-8">
      {/* Capability Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{capability.name}</h1>
        <div className="flex gap-2 mb-4">
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
            {capability.group_name}
          </span>
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
            {capability.type}
          </span>
        </div>
        <p className="text-gray-600 text-lg">{capability.description}</p>
      </div>

      {/* Level Definitions */}
      <div className="mb-8">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-2xl font-semibold mb-6">Level Definitions</h2>
            <div className="space-y-6">
              {capability.levelDefinitions?.map((level) => (
                <div key={level.level} className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-xl font-semibold mb-2">{level.level}</h3>
                  <p className="text-gray-600 mb-4">{level.description}</p>
                  <div className="space-y-2">
                    {level.indicators.map((indicator, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        <p>{indicator}</p>
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
            <h2 className="text-2xl font-semibold mb-4">Related Skills</h2>
            <div className="flex flex-wrap gap-2">
              {capability.relatedSkills?.map((skill) => (
                <span
                  key={skill}
                  className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Development Advice */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Development Advice</h2>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-2">Learning Resources</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Complete strategic planning certification courses</li>
                <li>Participate in strategy development workshops</li>
                <li>Shadow experienced strategic planners</li>
                <li>Lead small-scale strategic initiatives</li>
              </ul>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold mb-2">Practical Experience</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Volunteer for strategic planning committees</li>
                <li>Contribute to departmental strategy sessions</li>
                <li>Mentor others in strategic thinking</li>
                <li>Present strategic recommendations to leadership</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 