import { useState } from 'react';

interface EmployeeData {
  name: string;
  currentRole: string;
  department: string;
  tenure: string;
  skills: string[];
  preferences?: {
    desiredRoles: string[];
  };
}

interface RoleData {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
  requirements: string[];
  skills: string[];
}

interface UnifiedResultsViewProps {
  employeeData?: EmployeeData | null;
  roleData?: RoleData | null;
  startContext?: 'employee' | 'role' | 'open';
}

export default function UnifiedResultsView({ 
  employeeData, 
  roleData, 
  startContext = 'open' 
}: UnifiedResultsViewProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'role' | 'candidates' | 'roles'>(() => {
    // Set initial tab based on context
    if (startContext === 'employee') return 'profile';
    if (startContext === 'role') return 'role';
    return 'candidates';
  });

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
    </div>
  );

  const renderRoleDetails = () => (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-blue-950">{roleData?.title}</h2>
        <p className="text-base text-gray-600 mt-1">
          {roleData?.department} • {roleData?.location}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
        <p className="text-sm text-gray-600">{roleData?.description}</p>
      </div>

      {roleData?.skills && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Required Skills</h3>
          <div className="flex flex-wrap gap-2">
            {roleData.skills.map((skill, index) => (
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

      {roleData?.requirements && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Requirements</h3>
          <ul className="list-disc list-inside space-y-1">
            {roleData.requirements.map((req, index) => (
              <li key={index} className="text-sm text-gray-600">{req}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const LoadingState = () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-500">Loading...</div>
    </div>
  );

  return (
    <div className="flex gap-6">
      {/* Left Panel - Chat Interface */}
      <div className="w-1/2 bg-white rounded-2xl shadow-sm">
        {/* Chat interface will go here */}
        <div className="h-[600px] p-6">
          <div className="text-sm text-gray-600">
            Chat interface will be implemented here...
          </div>
        </div>
      </div>

      {/* Right Panel - Context and Results */}
      <div className="w-1/2 bg-white rounded-2xl shadow-sm flex flex-col">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <div className="flex">
            {/* Show Profile tab only if we have employee data */}
            {employeeData && (
              <button
                className={`px-6 py-4 text-sm font-medium transition-colors relative
                  ${activeTab === 'profile'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('profile')}
              >
                Employee Profile
              </button>
            )}
            
            {/* Show Role tab only if we have role data */}
            {roleData && (
              <button
                className={`px-6 py-4 text-sm font-medium transition-colors relative
                  ${activeTab === 'role'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('role')}
              >
                Role Details
              </button>
            )}

            {/* Always show Candidates tab */}
            <button
              className={`px-6 py-4 text-sm font-medium transition-colors relative
                ${activeTab === 'candidates'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('candidates')}
            >
              Matching Candidates
            </button>

            {/* Always show Roles tab */}
            <button
              className={`px-6 py-4 text-sm font-medium transition-colors relative
                ${activeTab === 'roles'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('roles')}
            >
              Matching Roles
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'profile' && employeeData && renderEmployeeProfile()}
          {activeTab === 'role' && roleData && renderRoleDetails()}
          {activeTab === 'candidates' && <LoadingState />}
          {activeTab === 'roles' && <LoadingState />}
        </div>
      </div>
    </div>
  );
} 