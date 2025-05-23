import { useState } from 'react';
import { XMarkIcon, InformationCircleIcon, ChartBarIcon, LightBulbIcon, ClipboardDocumentCheckIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

interface Match {
  id: string;
  name: string;
  type: 'role' | 'profile';
  matchPercentage: number;
  matchStatus?: string;
}

interface MatchListProps {
  matches: Match[];
  onAction: (action: string, message: string, params: Record<string, any>) => void;
  onRemove: (id: string) => void;
}

export default function MatchList({ matches, onAction, onRemove }: MatchListProps) {
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const handleAction = (actionId: string, match: Match) => {
    let message = '';
    const params = match.type === 'profile' 
      ? { profileId: match.id, profileName: match.name }
      : { roleId: match.id, roleTitle: match.name };

    switch (actionId) {
      case 'getProfileContext':
      case 'getRoleDetails':
        message = `Can you tell me more about ${match.type === 'profile' ? match.name : `the ${match.name} role`}?`;
        break;
      case 'getCapabilityGaps':
        message = match.type === 'profile'
          ? `What capability gaps does ${match.name} have for this role?`
          : `What capability gaps do I have for the ${match.name} role?`;
        break;
      case 'getSemanticSkillRecommendations':
        message = match.type === 'profile'
          ? `What skills should ${match.name} develop for this role?`
          : `What skills should I develop for the ${match.name} role?`;
        break;
      case 'getReadinessAssessment':
        message = match.type === 'profile'
          ? `How ready is ${match.name} for this role?`
          : `How ready am I for the ${match.name} role?`;
        break;
      case 'getDevelopmentPlan':
        message = match.type === 'profile'
          ? `Create a development plan for ${match.name} for this role`
          : `Create a development plan for me for the ${match.name} role`;
        break;
      default:
        message = `Can you ${actionId.toLowerCase()} for ${match.name}?`;
    }

    onAction(actionId, message, params);
  };

  const ActionButton = ({ icon: Icon, label, onClick }: { 
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
    >
      <Icon className="h-5 w-5 text-gray-400" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      {matches.map((match) => (
        <div key={match.id} className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{match.name}</h3>
              <div className="flex items-center mt-1">
                <span className="text-sm text-gray-500">Match Score:</span>
                <span className="ml-2 text-sm font-medium text-blue-600">{match.matchPercentage}%</span>
              </div>
            </div>
            <button
              onClick={() => onRemove(match.id)}
              className="text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          
          <div className="space-y-2">
            <ActionButton
              icon={InformationCircleIcon}
              label={`Learn More About ${match.type === 'profile' ? match.name : `the ${match.name} role`}`}
              onClick={() => handleAction(match.type === 'profile' ? 'getProfileContext' : 'getRoleDetails', match)}
            />
            <ActionButton
              icon={ChartBarIcon}
              label="View Capability Gaps"
              onClick={() => handleAction('getCapabilityGaps', match)}
            />
            <ActionButton
              icon={LightBulbIcon}
              label="View Skill Recommendations"
              onClick={() => handleAction('getSemanticSkillRecommendations', match)}
            />
            <ActionButton
              icon={ClipboardDocumentCheckIcon}
              label="Get Readiness Assessment"
              onClick={() => handleAction('getReadinessAssessment', match)}
            />
            <ActionButton
              icon={DocumentTextIcon}
              label="Get Development Plan"
              onClick={() => handleAction('getDevelopmentPlan', match)}
            />
          </div>
        </div>
      ))}
    </div>
  );
} 