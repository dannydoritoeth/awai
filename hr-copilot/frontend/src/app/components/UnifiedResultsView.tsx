import { useState } from 'react';
import ChatInterface from './ChatInterface';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface ProfileData {
  name: string;
  currentRole: string;
  department: string;
  tenure: string;
  skills: string[];
  preferences?: {
    desiredRoles: string[];
  };
  additionalContext?: string;
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
  profileData?: ProfileData | null;
  roleData?: RoleData | null;
  startContext?: 'profile' | 'role' | 'open';
}

export default function UnifiedResultsView({ 
  profileData, 
  roleData, 
  startContext = 'open' 
}: UnifiedResultsViewProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'role' | 'candidates' | 'roles'>(() => {
    // Set initial tab based on context
    if (startContext === 'profile') return 'profile';
    if (startContext === 'role') return 'role';
    return 'candidates';
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [additionalContext, setAdditionalContext] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleSendMessage = async (message: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: message,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // TODO: Send message to AI and get response
    // For now, simulate AI response after a delay
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm analyzing your request. This is a placeholder response that will be replaced with actual AI responses once the backend is integrated.",
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const renderProfile = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
          <span className="text-blue-600 font-semibold text-xl">
            {profileData?.name.split(' ').map(n => n[0]).join('')}
          </span>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {profileData?.name}
          </h2>
          <p className="text-base text-gray-600 mt-1">
            {profileData?.currentRole} • {profileData?.department}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {profileData?.tenure} tenure
          </p>
        </div>
      </div>

      {profileData?.skills && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Key Skills</h3>
          <div className="flex flex-wrap gap-2">
            {profileData.skills.map((skill, index) => (
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

      {profileData?.preferences?.desiredRoles && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Career Interests</h3>
          <div className="flex flex-wrap gap-2">
            {profileData.preferences.desiredRoles.map((role, index) => (
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

      {/* Additional Context Section */}
      <div className="space-y-3 border-t border-gray-200 pt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Additional Context</h3>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
        </div>
        
        {isEditing ? (
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Add any additional context about your profile that might be helpful for the AI (e.g., career goals, specific experiences, preferences)..."
            className="w-full rounded-lg border-none focus:ring-0 bg-gray-50 text-gray-900 placeholder:text-gray-500 text-sm py-3 px-4 resize-none min-h-[128px] max-h-[256px]"
          />
        ) : (
          <div className="bg-gray-50 rounded-lg p-4">
            {additionalContext || profileData?.additionalContext ? (
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {additionalContext || profileData?.additionalContext}
              </p>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No additional context provided. Click &apos;Edit&apos; to add information about career goals, specific experiences, or preferences.
              </p>
            )}
          </div>
        )}
      </div>
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
        <div className="h-[600px]">
          <ChatInterface
            onSendMessage={handleSendMessage}
            messages={messages}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Right Panel - Context and Results */}
      <div className="w-1/2 bg-white rounded-2xl shadow-sm flex flex-col">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          <div className="flex">
            {/* Show Profile tab only if we have profile data */}
            {profileData && (
              <button
                className={`px-6 py-4 text-sm font-medium transition-colors relative
                  ${activeTab === 'profile'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setActiveTab('profile')}
              >
                Your Profile
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
          {activeTab === 'profile' && profileData && renderProfile()}
          {activeTab === 'role' && roleData && renderRoleDetails()}
          {activeTab === 'candidates' && <LoadingState />}
          {activeTab === 'roles' && <LoadingState />}
        </div>
      </div>
    </div>
  );
} 