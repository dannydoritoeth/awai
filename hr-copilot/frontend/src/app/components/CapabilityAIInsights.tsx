import { Card, CardContent } from '@/components/ui/card';

interface CapabilityAIInsightsProps {
  capabilityId: string;
  capabilityName: string;
}

export default function CapabilityAIInsights({ capabilityId, capabilityName }: CapabilityAIInsightsProps) {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900">AI Insights</h2>
        </div>
        
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Summary</h3>
            <p className="text-blue-800">
              {`Analyzing roles and patterns for the ${capabilityName} capability...`}
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-2">Key Observations</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Common role requirements</li>
              <li>Level distribution across roles</li>
              <li>Related capabilities and skills</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 