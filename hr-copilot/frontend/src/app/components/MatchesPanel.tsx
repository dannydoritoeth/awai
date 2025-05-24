'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';

interface Match {
  id: string;
  name: string;
  matchPercentage: number;
  matchStatus: string;
  type: 'role' | 'profile';
}

interface MatchesPanelProps {
  matches: Match[];
  onExplainMatch: (name: string) => void;
  onDevelopmentPath: (name: string) => void;
  onCompare: (name: string) => void;
  profileId?: string;
  sessionId: string;
}

export default function MatchesPanel({
  matches,
  onExplainMatch,
  onDevelopmentPath,
  onCompare,
  profileId,
  sessionId
}: MatchesPanelProps) {
  const handleAction = async (action: string, match: Match) => {
    console.log('Action clicked:', { action, match, profileId, sessionId });
    
    let message = '';
    let actionId = '';
    
    switch (action) {
      case 'learn':
        message = `Can you tell me more about ${match.name}?`;
        actionId = 'getRoleDetails';
        break;
      case 'explain':
        message = `Explain why this would be a good match for ${match.name}?`;
        actionId = 'explainMatch';
        break;
      case 'gaps':
        message = `What capability gaps are there for ${match.name}?`;
        actionId = 'getCapabilityGaps';
        break;
      case 'skills':
        message = `What skills should be developed for ${match.name}?`;
        actionId = 'getSemanticSkillRecommendations';
        break;
      case 'development':
        message = `Can you create a development plan for ${match.name}?`;
        actionId = 'getDevelopmentPlan';
        break;
      case 'compare':
        message = `Can you compare my profile to ${match.name}?`;
        actionId = 'compareToRole';
        break;
    }

    console.log('Generated message and actionId:', { message, actionId });

    // Prepare request body with all necessary parameters
    const requestBody = {
      action: 'postMessage',
      sessionId,
      message,
      actionId,
      roleId: match.id,
      roleTitle: match.name,
      ...(profileId && { profileId })
    };

    console.log('Preparing request with body:', requestBody);
    console.log('Using URL:', `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`);
    console.log('Using auth:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Auth key present' : 'Auth key missing');

    try {
      // Send request to chat endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to execute action: ${response.statusText}. Details: ${errorText}`);
      }

      const responseData = await response.json();
      console.log('Response data:', responseData);

      // Call the appropriate callback
      switch (action) {
        case 'explain':
          console.log('Calling onExplainMatch with:', match.name);
          onExplainMatch(match.name);
          break;
        case 'development':
          console.log('Calling onDevelopmentPath with:', match.name);
          onDevelopmentPath(match.name);
          break;
        case 'compare':
          console.log('Calling onCompare with:', match.name);
          onCompare(match.name);
          break;
      }

    } catch (error) {
      console.error('Error executing action:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
    }
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
                      <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Learn More
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      onSelect={() => handleAction('explain', match)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center"
                    >
                      <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Explain Match
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      onSelect={() => handleAction('gaps', match)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center"
                    >
                      <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      View Capability Gaps
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      onSelect={() => handleAction('skills', match)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center"
                    >
                      <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      View Skill Recommendations
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      onSelect={() => handleAction('development', match)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center"
                    >
                      <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      Get Development Path
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                      onSelect={() => handleAction('compare', match)}
                      className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center"
                    >
                      <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Compare To ...
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