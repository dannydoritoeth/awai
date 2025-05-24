'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { InformationCircleIcon, DocumentMagnifyingGlassIcon, ChartBarIcon, LightBulbIcon, ClipboardDocumentCheckIcon, ClipboardIcon } from '@heroicons/react/24/outline';

interface Match {
  id: string;
  name: string;
  matchPercentage: number;
  matchStatus: string;
  type: 'role' | 'profile';
}

interface MatchesPanelProps {
  matches: Match[];
  onAction: (action: string, match: Match) => void;
  profileId?: string;
  sessionId: string;
}

export default function MatchesPanel({
  matches,
  onAction,
  profileId,
  sessionId
}: MatchesPanelProps) {
  const handleAction = async (action: string, match: Match) => {
    console.log('Action clicked:', { action, match, profileId, sessionId });
    
    // Call the parent's onAction handler
    onAction(action, match);

    // Remove the duplicate callback handling since it's now handled by onAction
    console.log('Action handled by parent component');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {matches.map((match) => (
          <div 
            key={match.id}
            className="p-4 border-b last:border-b-0 hover:bg-gray-50"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-medium text-gray-900">{match.name}</h3>
              
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <EllipsisHorizontalIcon className="h-5 w-5" />
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-[9999] w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100"
                    sideOffset={5}
                  >
                    <DropdownMenu.Item
                      onSelect={() => handleAction('learn', match)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center"
                    >
                      <InformationCircleIcon className="mr-3 h-5 w-5 text-gray-400" />
                      Learn More
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      onSelect={() => handleAction('explain', match)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center"
                    >
                      <DocumentMagnifyingGlassIcon className="mr-3 h-5 w-5 text-gray-400" />
                      Explain Match
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      onSelect={() => handleAction('gaps', match)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center"
                    >
                      <ChartBarIcon className="mr-3 h-5 w-5 text-gray-400" />
                      View Capability Gaps
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      onSelect={() => handleAction('skills', match)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center"
                    >
                      <LightBulbIcon className="mr-3 h-5 w-5 text-gray-400" />
                      View Skill Recommendations
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      onSelect={() => handleAction('readiness', match)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center"
                    >
                      <ClipboardIcon className="mr-3 h-5 w-5 text-gray-400" />
                      Get Readiness Assessment
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      onSelect={() => handleAction('development', match)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center"
                    >
                      <ClipboardDocumentCheckIcon className="mr-3 h-5 w-5 text-gray-400" />
                      Get Development Plan
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
            
            <div className="text-sm text-gray-600">
              Match {match.matchStatus}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 