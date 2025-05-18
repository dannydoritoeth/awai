'use client';

interface Match {
  id: string;
  name: string;
  matchPercentage: number;
  matchStatus: string;
}

interface MatchesPanelProps {
  matches: Match[];
  onExplainMatch: (name: string) => void;
  onDevelopmentPath: (name: string) => void;
  onCompare: (name: string) => void;
}

export default function MatchesPanel({
  matches,
  onExplainMatch,
  onDevelopmentPath,
  onCompare
}: MatchesPanelProps) {
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
              <span className="text-lg font-semibold text-blue-600">{match.matchPercentage}%</span>
            </div>
            
            <div className="text-sm text-gray-600 mb-3">
              Match {match.matchStatus}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onExplainMatch(match.name)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Explain Match
              </button>
              
              <button
                onClick={() => onDevelopmentPath(match.name)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Development Path
              </button>
              
              <button
                onClick={() => onCompare(match.name)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Compare
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 