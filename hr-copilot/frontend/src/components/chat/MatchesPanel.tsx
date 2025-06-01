'use client';

import { useState } from 'react';
import type { Match } from './UnifiedResultsView';

interface MatchesPanelProps {
  matches: Match[];
  onAction: (action: string, match: Match) => void;
}

export default function MatchesPanel({
  matches,
  onAction
}: MatchesPanelProps) {
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const handleMatchClick = (matchId: string) => {
    setExpandedMatch(expandedMatch === matchId ? null : matchId);
  };

  const handleAction = (action: string, match: Match) => {
    onAction(action, match);
  };

  return (
    <div className="p-4 space-y-4">
      {matches.map((match) => (
        <div
          key={match.id}
          className="bg-gray-50 rounded-lg overflow-hidden"
        >
          {/* Match Header */}
          <button
            onClick={() => handleMatchClick(match.id)}
            className="w-full p-4 text-left flex items-center justify-between"
          >
            <div>
              <h3 className="text-sm font-medium text-gray-900">{match.name}</h3>
              <p className="text-sm text-gray-600">
                {(match.matchPercentage * 100).toFixed(1)}% match
              </p>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 transform transition-transform ${
                expandedMatch === match.id ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Expanded Content */}
          {expandedMatch === match.id && (
            <div className="px-4 pb-4 space-y-2">
              <button
                onClick={() => handleAction('learn', match)}
                className="w-full py-2 px-3 text-sm text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Learn more about {match.type === 'role' ? 'this role' : 'this profile'}
              </button>
              <button
                onClick={() => handleAction('explain', match)}
                className="w-full py-2 px-3 text-sm text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Explain why this is a good match
              </button>
              <button
                onClick={() => handleAction('gaps', match)}
                className="w-full py-2 px-3 text-sm text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Identify capability gaps
              </button>
              <button
                onClick={() => handleAction('skills', match)}
                className="w-full py-2 px-3 text-sm text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Get skill recommendations
              </button>
              <button
                onClick={() => handleAction('readiness', match)}
                className="w-full py-2 px-3 text-sm text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Assess readiness
              </button>
              <button
                onClick={() => handleAction('development', match)}
                className="w-full py-2 px-3 text-sm text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Create development plan
              </button>
              <button
                onClick={() => handleAction('compare', match)}
                className="w-full py-2 px-3 text-sm text-left text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Compare with current {match.type === 'role' ? 'role' : 'profile'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 