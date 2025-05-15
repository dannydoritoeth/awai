import { useState, useEffect, useRef } from 'react';
import ChatInterface from './ChatInterface';
import { getSessionMessages } from '@/lib/api/chat';
import type { ChatMessage } from '@/types/chat';

interface ProfileData {
  id: string;
  name: string;
  currentRole?: string;
  department?: string;
  tenure?: string;
  skills?: Array<{
    name: string;
    level?: number | null;
  }>;
  roles?: Array<{
    title: string;
    company: string;
    years: number;
  }>;
  preferences?: {
    desiredRoles: string[];
  };
  additionalContext?: string;
}

interface RoleData {
  id: string;
  title: string;
  company: string;
  department?: string;
  location?: string;
  description?: string;
  skills?: string[];
  requirements?: string[];
}

interface UnifiedResultsViewProps {
  sessionId: string;
  profileData?: ProfileData;
  roleData?: RoleData;
  startContext?: 'profile' | 'role' | 'open';
}

export default function UnifiedResultsView({ 
  sessionId,
  profileData,
  roleData,
  startContext = 'open'
}: UnifiedResultsViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [additionalContext, setAdditionalContext] = useState(profileData?.additionalContext || '');
  const [activeTab, setActiveTab] = useState<'profile' | 'role' | 'matches'>(() => {
    if (startContext === 'profile') return 'profile';
    if (startContext === 'role') return 'role';
    return 'matches';
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageRef = useRef<ChatMessage | null>(null);

  useEffect(() => {
    setAdditionalContext(profileData?.additionalContext || '');
  }, [profileData]);

  useEffect(() => {
    // Update isWaitingForResponse based on the last message
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender === 'user') {
        setIsWaitingForResponse(true);
      } else {
        setIsWaitingForResponse(false);
      }
      lastMessageRef.current = lastMessage;
    }
  }, [messages]);

  useEffect(() => {
    if (!sessionId) return;

    const pollMessages = async () => {
      try {
        const newMessages = await getSessionMessages(sessionId);
        setMessages(prev => {
          // Create a Set of existing message IDs for efficient lookup
          const existingIds = new Set(prev.map(msg => msg.id));
          
          // Filter out messages we already have
          const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
          
          // Only update if we have new unique messages
          if (uniqueNewMessages.length > 0) {
            setIsInitializing(false);
            setIsLoading(false);
            
            // Check if we received an AI response
            const hasNewAIMessage = uniqueNewMessages.some(msg => msg.sender === 'assistant');
            if (hasNewAIMessage) {
              setIsWaitingForResponse(false);
            }
            
            return [...prev, ...uniqueNewMessages] as ChatMessage[];
          }
          return prev;
        });
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        setIsLoading(false);
      }
    };

    // Initial fetch
    pollMessages();

    // Set up polling
    pollTimeoutRef.current = setInterval(pollMessages, 2000);

    // Set a timeout to disable initializing state if no messages arrive
    const initTimeout = setTimeout(() => {
      setIsInitializing(false);
      setIsLoading(false);
    }, 5000);

    // Cleanup
    return () => {
      if (pollTimeoutRef.current) {
        clearInterval(pollTimeoutRef.current);
      }
      clearTimeout(initTimeout);
    };
  }, [sessionId]);

  // Scroll to top when data is loaded
  useEffect(() => {
    if (!isLoading && !isInitializing && !isDataLoaded) {
      setIsDataLoaded(true);
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        // Also scroll the container to top
        if (containerRef.current) {
          containerRef.current.scrollTo({ top: 0, behavior: 'instant' });
        }
      });
    }
  }, [isLoading, isInitializing, isDataLoaded]);

  const handleSendMessage = async (message: string) => {
    if (!sessionId || !message.trim()) return;

    const messageId = crypto.randomUUID();
    
    // Add user message to local state
    const userMessage: ChatMessage = {
      id: messageId,
      message: message,
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    
    setMessages((prev: ChatMessage[]) => [...prev, userMessage]);
    setIsWaitingForResponse(true); // Set waiting state when sending message
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          action: 'postMessage',
          sessionId,
          messageId,
          message
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await response.json();
      
    } catch (error) {
      console.error('Failed to send message:', error);

      // Remove the user message if the send failed
      setMessages((prev: ChatMessage[]) => prev.filter(msg => msg.id !== messageId));
      setIsWaitingForResponse(false); // Reset waiting state on error

      // Show error message to user
      const errorMessageId = crypto.randomUUID();
      const errorMessage: ChatMessage = {
        id: errorMessageId,
        message: error instanceof Error 
          ? `Error: ${error.message}` 
          : 'Sorry, I encountered an error. Please try again.',
        sender: 'assistant',
        timestamp: new Date().toISOString()
      };
      
      setMessages((prev: ChatMessage[]) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (n: number | undefined | null): string => {
    if (n === undefined || n === null) return '-';
    return n.toString();
  };

  const renderSkillLevel = (skill: { name: string; level?: number | null }, index: number) => {
    return (
      <div key={index} className="flex items-center gap-2">
        <span className="text-gray-900">{skill.name}</span>
        <span className="text-gray-700">{formatNumber(skill.level)}</span>
      </div>
    );
  };

  const renderRole = (role: { title: string; company: string; years: number }, index: number) => {
    return (
      <div key={index} className="mb-2">
        <div className="font-medium text-gray-900">{role.title}</div>
        <div className="text-sm text-gray-700">
          {role.company} • {role.years} years
        </div>
      </div>
    );
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
          <p className="text-base text-gray-800 mt-1">
            {profileData?.currentRole} • {profileData?.department}
          </p>
          <p className="text-sm text-gray-700 mt-1">
            {profileData?.tenure} tenure
          </p>
        </div>
      </div>

      {profileData?.skills && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Key Skills</h3>
          <div className="flex flex-wrap gap-2">
            {profileData.skills.map((skill, index) => renderSkillLevel(skill, index))}
          </div>
        </div>
      )}

      {profileData?.roles && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Previous Roles</h3>
          <div className="flex flex-col gap-2">
            {profileData.roles.map((role, index) => renderRole(role, index))}
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
              <p className="text-sm text-gray-600 italic">
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
        <h2 className="text-xl font-semibold text-gray-900">{roleData?.title}</h2>
        <p className="text-base text-gray-800 mt-1">
          {roleData?.department} • {roleData?.location}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-2">Description</h3>
        <p className="text-sm text-gray-800">{roleData?.description}</p>
      </div>

      {roleData?.skills && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Required Skills</h3>
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
          <h3 className="text-sm font-medium text-gray-900 mb-2">Requirements</h3>
          <ul className="list-disc list-inside space-y-1">
            {roleData.requirements.map((req, index) => (
              <li key={index} className="text-sm text-gray-800">{req}</li>
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
    <div ref={containerRef} className="flex gap-6 min-h-[600px]">
      {/* Left Panel - Chat Interface */}
      <div className="flex-1 max-w-[766px] bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="h-full">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading || isWaitingForResponse || (messages.length === 0 && isInitializing)}
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
                Profile Details
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