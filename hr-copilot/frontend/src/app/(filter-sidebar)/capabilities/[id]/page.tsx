'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getCapability, type Capability } from '@/lib/services/capabilities';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import CapabilityInfoPanel from '@/app/components/CapabilityInfoPanel';
import CapabilityAIInsights from '@/app/components/CapabilityAIInsights';

interface Role {
  id: string;
  title: string;
  required_level: string;
}

interface CapabilityDetails extends Capability {
  roles?: Role[];
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
        setLoading(true);
        const data = await getCapability(params.id as string);
        setCapability(data);
      } catch (error) {
        console.error('Error loading capability:', error);
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
    <div className="flex min-h-screen">
      {/* Main Content Area */}
      <div className="flex-1 p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 text-gray-900">{capability.name}</h1>
          <div className="flex gap-2">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
              {capability.group_name}
            </span>
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
              {capability.type}
            </span>
            {capability.level && (
              <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
                Level: {capability.level}
              </span>
            )}
          </div>
        </div>

        {/* AI Insights */}
        <CapabilityAIInsights 
          capabilityId={capability.id} 
          capabilityName={capability.name}
        />

        {/* Related Roles */}
        {capability.roles && capability.roles.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">Related Roles</h2>
              <div className="space-y-2">
                {capability.roles.map((role) => (
                  <Link key={role.id} href={`/roles/specific/${role.id}`}>
                    <div className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium text-gray-900">{role.title}</h3>
                        {role.required_level && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                            Required Level: {role.required_level}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Panel */}
      <div className="w-80 p-8 border-l border-gray-200">
        <CapabilityInfoPanel capability={capability} />
      </div>
    </div>
  );
} 