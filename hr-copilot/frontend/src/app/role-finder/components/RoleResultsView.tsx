'use client';

import { useState } from 'react';

interface EmployeeData {
  id: string;
  name: string;
  currentRole: string;
  department: string;
  tenure: string;
  skills: string[];
  experience: {
    role: string;
    duration: string;
  }[];
  preferences?: {
    desiredRoles?: string[];
    locations?: string[];
    workStyle?: string[];
  };
}

interface RoleMatch {
  id: string;
  title: string;
  department: string;
  location: string;
  matchPercentage: number;
  matchDetails: {
    skillsMatch: number;
    experienceMatch: number;
    careerPathMatch: number;
  };
  requiredSkills: string[];
  matchedSkills: string[];
  careerProgression: string;
}

interface RoleResultsViewProps {
  employeeData: EmployeeData | null;
}

type TabType = 'profile' | 'matches';

export default function RoleResultsView({ employeeData }: RoleResultsViewProps) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('matches');
  
  // Mock data - will be replaced with real data
  const roles: RoleMatch[] = [
    {
      id: '1',
      title: 'Senior Software Engineer',
      department: 'Engineering',
      location: 'Melbourne',
      matchPercentage: 92,
      matchDetails: {
        skillsMatch: 95,
        experienceMatch: 88,
        careerPathMatch: 93
      },
      requiredSkills: ['JavaScript', 'React', 'Node.js', 'System Design', 'Team Leadership'],
      matchedSkills: ['JavaScript', 'React', 'Node.js', 'AWS'],
      careerProgression: 'Tech Lead → Engineering Manager'
    },
  ];

  const renderMatchBar = (percentage: number) => (
    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
      <div 
        className="h-full bg-blue-600 rounded-full"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );

  const renderEmployeeProfile = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
          <span className="text-blue-600 font-semibold text-xl">
            {employeeData?.name.split(' ').map(n => n[0]).join('')}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-blue-950">
            {employeeData?.name}
          </h2>
          <p className="text-base text-gray-600 mt-1">
            {employeeData?.currentRole} • {employeeData?.department}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {employeeData?.tenure} tenure
          </p>
        </div>
      </div>

      {employeeData?.skills && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Key Skills</h3>
          <div className="flex flex-wrap gap-2">
            {employeeData.skills.map((skill, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {employeeData?.preferences?.desiredRoles && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Career Interests</h3>
          <div className="flex flex-wrap gap-2">
            {employeeData.preferences.desiredRoles.map((role, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full font-medium"
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Additional sections can be added here */}
    </div>
  );

  const renderMatchingRoles = () => (
    <div className="p-6 space-y-6 overflow-y-auto h-[calc(100%-4rem)]">
      {roles.map((role) => (
        <div
          key={role.id}
          className={`rounded-lg border transition-all cursor-pointer overflow-hidden
            ${selectedRole === role.id 
              ? 'border-blue-500 bg-white shadow-md' 
              : 'border-gray-200 hover:border-blue-200 hover:shadow-sm'}`}
          onClick={() => setSelectedRole(role.id)}
        >
          <div className="p-6 border-b border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-blue-950">{role.title}</h3>
                <p className="text-base text-gray-600 mt-1">
                  {role.department} • {role.location}
                </p>
              </div>
              <div className="flex items-center bg-blue-50 px-4 py-2 rounded-lg">
                <span className="text-lg font-bold text-blue-600">
                  {role.matchPercentage}%
                </span>
                <span className="text-sm text-blue-600 ml-1">Match</span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-gray-50">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Skills match</span>
                    <span className="text-sm font-semibold text-blue-600">{role.matchDetails.skillsMatch}%</span>
                  </div>
                  {renderMatchBar(role.matchDetails.skillsMatch)}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Experience</span>
                    <span className="text-sm font-semibold text-blue-600">{role.matchDetails.experienceMatch}%</span>
                  </div>
                  {renderMatchBar(role.matchDetails.experienceMatch)}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Career path</span>
                    <span className="text-sm font-semibold text-blue-600">{role.matchDetails.careerPathMatch}%</span>
                  </div>
                  {renderMatchBar(role.matchDetails.careerPathMatch)}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Matched Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {role.matchedSkills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Career Path</h4>
                  <p className="text-sm text-gray-600">{role.careerProgression}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button className="text-sm font-medium text-blue-600 hover:text-blue-700">
                View full role details →
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
          <h2 className="text-2xl font-semibold text-blue-950 mb-1">AI Assistant</h2>
          <p className="text-base text-gray-600">Let me help you find the perfect role</p>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto mb-6 space-y-4">
          <div className="bg-blue-50 rounded-lg p-4 max-w-[80%]">
            <p className="text-base text-gray-700 leading-relaxed">
              Based on {employeeData?.name}'s experience with React and Node.js, 
              they would be a strong fit for the Senior Software Engineer role. 
              Their current role has given them valuable team leadership experience, 
              which aligns well with the career progression to Tech Lead.
            </p>
          </div>
        </div>

        {/* Chat Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Ask me about potential roles..."
            className="w-full rounded-lg border-none focus:ring-0 bg-gray-50 text-gray-900 placeholder:text-gray-500 text-sm py-3 px-4"
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
                ${activeTab === 'profile'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('profile')}
            >
              Employee Profile
            </button>
            <button
              className={`px-6 py-4 text-sm font-medium transition-colors relative
                ${activeTab === 'matches'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('matches')}
            >
              Matching Roles
            </button>
          </div>
          <button
            onClick={() => window.location.reload()} // Temporary solution - should use proper state management
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Change Employee →
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'profile' ? renderEmployeeProfile() : renderMatchingRoles()}
        </div>
      </div>
    </div>
  );
} 