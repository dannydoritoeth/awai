'use client';

import { useState } from 'react';
import Image from 'next/image';

interface RoleData {
  jobTitle?: string;
  pageUpId?: string;
  description?: string;
  skills?: string;
  location?: string;
  employmentType?: string;
}

interface MatchBreakdown {
  skillsMatch: number;
  experienceMatch: number;
  tagMatch: number;
}

interface Candidate {
  id: string;
  name: string;
  currentRole: string;
  tenure: string;
  matchPercentage: number;
  matchBreakdown: MatchBreakdown;
  tags: string[];
  imageUrl?: string;
}

interface ResultsViewProps {
  roleData: RoleData | null;
}

type TabType = 'role' | 'candidates';

export default function ResultsView({ roleData }: ResultsViewProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('candidates');
  
  // Mock data - will be replaced with real data
  const candidates: Candidate[] = [
    {
      id: '1',
      name: 'Sarah Chen',
      currentRole: 'Senior Developer',
      tenure: '3 years',
      matchPercentage: 92,
      matchBreakdown: {
        skillsMatch: 95,
        experienceMatch: 88,
        tagMatch: 93
      },
      tags: ['React', 'TypeScript', 'Team Lead'],
    },
    // More candidates will be added here
  ];

  const renderMatchBar = (percentage: number) => (
    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
      <div 
        className="h-full bg-blue-600 rounded-full"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );

  const renderRoleDetails = () => (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-blue-950">
          {roleData?.jobTitle || roleData?.pageUpId || 'Selected Role'}
        </h2>
        <p className="text-base text-gray-600 mt-1">
          {roleData?.location} • {roleData?.employmentType}
        </p>
      </div>

      {roleData?.description && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
          <p className="text-base text-gray-600 whitespace-pre-wrap">{roleData.description}</p>
        </div>
      )}

      {roleData?.skills && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Required Skills</h3>
          <div className="flex flex-wrap gap-2">
            {roleData.skills.split(',').map((skill: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full font-medium"
              >
                {skill.trim()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderCandidates = () => (
    <div className="p-6 space-y-6">
      {candidates.map((candidate) => (
        <div
          key={candidate.id}
          className={`rounded-lg border transition-all cursor-pointer overflow-hidden
            ${selectedCandidate === candidate.id 
              ? 'border-blue-500 bg-white shadow-md' 
              : 'border-gray-200 hover:border-blue-200 hover:shadow-sm'}`}
          onClick={() => setSelectedCandidate(candidate.id)}
        >
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start gap-4">
              {candidate.imageUrl ? (
                <Image
                  src={candidate.imageUrl}
                  alt={candidate.name}
                  width={56}
                  height={56}
                  className="rounded-full"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-xl">
                    {candidate.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
              )}
              
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-950">{candidate.name}</h3>
                    <p className="text-base text-gray-600">{candidate.currentRole}</p>
                    <p className="text-sm text-gray-500 mt-1">Tenure: {candidate.tenure}</p>
                  </div>
                  <div className="flex items-center bg-blue-50 px-4 py-2 rounded-lg">
                    <span className="text-lg font-bold text-blue-600">
                      {candidate.matchPercentage}%
                    </span>
                    <span className="text-sm text-blue-600 ml-1">Match</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Skills match</span>
                    <span className="text-sm font-semibold text-blue-600">{candidate.matchBreakdown.skillsMatch}%</span>
                  </div>
                  {renderMatchBar(candidate.matchBreakdown.skillsMatch)}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Experience</span>
                    <span className="text-sm font-semibold text-blue-600">{candidate.matchBreakdown.experienceMatch}%</span>
                  </div>
                  {renderMatchBar(candidate.matchBreakdown.experienceMatch)}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Tag match</span>
                    <span className="text-sm font-semibold text-blue-600">{candidate.matchBreakdown.tagMatch}%</span>
                  </div>
                  {renderMatchBar(candidate.matchBreakdown.tagMatch)}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Key Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {candidate.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-white text-gray-700 text-sm rounded-full font-medium border border-gray-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
                View full profile →
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-[calc(100vh-24rem)] flex gap-6">
      {/* Chat Assistant Panel */}
      <div className="w-1/2 bg-white rounded-2xl shadow-sm p-8 flex flex-col">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-blue-950 mb-1">TalentPathAI</h2>
          <p className="text-base text-gray-600">Let me help you find the perfect candidate</p>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto mb-6 space-y-4">
          <div className="bg-blue-50 rounded-lg p-4 max-w-[80%]">
            <p className="text-base text-gray-700 leading-relaxed">
              I&apos;ve analyzed the role requirements and found several strong matches. 
              Sarah Chen stands out with a 95% match due to her extensive experience 
              with React and TypeScript, plus her team leadership background.
            </p>
          </div>
        </div>

        {/* Chat Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Ask me about the candidates..."
            className="w-full rounded-lg border-gray-300 pr-12 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-700 placeholder:text-gray-400 text-base py-3"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Right Panel with Tabs */}
      <div className="w-1/2 bg-white rounded-2xl shadow-sm flex flex-col">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 justify-between items-center pr-4">
          <div className="flex">
            <button
              className={`px-6 py-4 text-sm font-medium transition-colors relative
                ${activeTab === 'role'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('role')}
            >
              Role Details
            </button>
            <button
              className={`px-6 py-4 text-sm font-medium transition-colors relative
                ${activeTab === 'candidates'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('candidates')}
            >
              Matching Candidates
            </button>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Edit Role →
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'role' ? renderRoleDetails() : renderCandidates()}
        </div>
      </div>
    </div>
  );
} 