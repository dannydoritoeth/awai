import { useState, useEffect, useRef } from 'react';
import ChatInterface from './ChatInterface';
import { startSession, getSessionMessages } from '@/lib/api/chat';
import { getBrowserSessionId } from '@/lib/browserSession';
import { events, EVENT_NAMES } from '@/lib/events';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface ProfileData {
  id: string;
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
  sessionId?: string;
}

export default function UnifiedResultsView({ 
  profileData, 
  roleData, 
  startContext = 'open',
  sessionId
}: UnifiedResultsViewProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'role' | 'matches'>(() => {
    if (startContext === 'profile') return 'profile';
    if (startContext === 'role') return 'role';
    return 'matches';
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [additionalContext, setAdditionalContext] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const lastMessageId = useRef<string | null>(null);
  const seenMessageIds = useRef<Set<string>>(new Set());

  // Poll for new messages
  useEffect(() => {
    if (!sessionId) return;

    const pollMessages = async () => {
      try {
        const newMessages = await getSessionMessages(sessionId);
        
        // Filter out messages we've already seen
        const unseenMessages = newMessages.filter(msg => !seenMessageIds.current.has(msg.id));

        if (unseenMessages.length > 0) {
          // Update seen message IDs
          unseenMessages.forEach(msg => seenMessageIds.current.add(msg.id));
          lastMessageId.current = unseenMessages[unseenMessages.length - 1].id;

          // Convert and add new messages
          const convertedMessages: Message[] = unseenMessages.map(msg => ({
            id: msg.id,
            text: msg.message,
            sender: msg.sender === 'assistant' ? 'ai' : 'user',
            timestamp: new Date(msg.timestamp)
          }));

          setMessages(prev => [...prev, ...convertedMessages]);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    // Initial fetch
    pollMessages();

    // Set up polling interval
    const intervalId = setInterval(pollMessages, 1000);

    // Cleanup
    return () => {
      clearInterval(intervalId);
      // Create a copy of the current ref value for cleanup
      const seenIds = new Set(seenMessageIds.current);
      seenIds.clear();
    };
  }, [sessionId]);

  // Initialize session
  useEffect(() => {
    const initializeSession = async () => {
      if (messages.length > 0 || !sessionId) return;

      let initialMessage = '';
      const browserSessionId = getBrowserSessionId();
      const request: Parameters<typeof startSession>[0] = {
        action: 'startSession',
        message: '',
        browserSessionId
      };

      if (profileData) {
        initialMessage = `I'm interested in finding roles that match my profile. I'm currently a ${profileData.currentRole} in ${profileData.department} with skills in ${profileData.skills.join(', ')}.`;
        if (profileData.preferences?.desiredRoles) {
          initialMessage += ` I'm particularly interested in roles like ${profileData.preferences.desiredRoles.join(', ')}.`;
        }
        if (additionalContext) {
          initialMessage += ` Additional context: ${additionalContext}`;
        }
        request.profileId = profileData.id;
      } else if (roleData) {
        initialMessage = `I'm looking for candidates who would be a good fit for this ${roleData.title} role in ${roleData.department}. The role requires skills in ${roleData.skills.join(', ')}.`;
        request.roleId = roleData.id;
      }

      if (initialMessage) {
        request.message = initialMessage;
        try {
          await startSession(request);
          events.emit(EVENT_NAMES.SESSION_CREATED);
        } catch (error) {
          console.error('Failed to initialize session:', error);
        }
      }
    };

    initializeSession();
  }, [profileData, roleData, additionalContext, sessionId, messages.length]);

  const handleSendMessage = async (message: string) => {
    if (!sessionId) return;

    // Add user message to local state
    const userMessage: Message = {
      id: Date.now().toString(),
      text: message,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Send message to API
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          action: 'sendMessage',
          sessionId,
          message
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // TODO: Show error message to user
    } finally {
      setIsLoading(false);
    }
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
    <div className="flex gap-6 min-h-[600px]">
      {/* Left Panel - Chat Interface */}
      <div className="flex-1 max-w-[766px] bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="h-full">
          <ChatInterface
            onSendMessage={handleSendMessage}
            messages={messages}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Right Panel - Context and Results */}
      <div className="w-[350px] bg-white rounded-2xl shadow-sm flex flex-col">
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

            {/* Always show Matches tab */}
            <button
              className={`px-6 py-4 text-sm font-medium transition-colors relative
                ${activeTab === 'matches'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('matches')}
            >
              Matches
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'profile' && profileData && renderProfile()}
          {activeTab === 'role' && roleData && renderRoleDetails()}
          {activeTab === 'matches' && <LoadingState />}
        </div>
      </div>
    </div>
  );
} 