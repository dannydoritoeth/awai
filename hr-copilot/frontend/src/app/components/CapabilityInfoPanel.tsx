import { Card, CardContent } from '@/components/ui/card';
import type { Capability } from '@/lib/services/capabilities';

interface CapabilityInfoPanelProps {
  capability: Capability;
}

export default function CapabilityInfoPanel({ capability }: CapabilityInfoPanelProps) {
  return (
    <Card className="w-80 h-fit">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* About Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
            <p className="text-gray-700">
              {capability.description || 'No description available.'}
            </p>
          </div>

          {/* Level Definitions */}
          {capability.levelDefinitions && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Level Definitions</h2>
              <div className="space-y-3">
                {capability.levelDefinitions.map((def) => (
                  <div key={def.level} className="p-3 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900">{def.level}</h3>
                    <p className="text-sm text-gray-700 mt-1">{def.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Details</h2>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Group</p>
                <p className="text-gray-900">{capability.group_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="text-gray-900">{capability.type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Level</p>
                <p className="text-gray-900">{capability.level}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 