'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, HeatmapRequestData } from '@/types/chat';
import { CapabilityData } from './CapabilityHeatmap';
import HeatmapModal from './HeatmapModal';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { 
  InformationCircleIcon, 
  DocumentMagnifyingGlassIcon, 
  ChartBarIcon, 
  LightBulbIcon, 
  ClipboardDocumentCheckIcon,
  ClipboardIcon 
} from '@heroicons/react/24/outline';
import React from 'react';

interface ActionButtonData {
  label: string;
  actionId: string;
  params: {
    profileId?: string;
    roleId?: string;
    roleTitle?: string;
    matchPercentage?: number;
    matchStatus?: string;
    [key: string]: unknown;
  };
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  groupId?: string;
}

interface ActionButtonGroupData {
  groupId: string;
  title: string;
  actions: ActionButtonData[];
}

interface HeatmapRequestParams {
  mode: string;
  insightId: string;
  sessionId: string;
  companyIds: string[];
}

interface HeatmapResponse {
  success: boolean;
  data: {
    raw: CapabilityData[];
  };
  error: string | null;
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

interface ProfileData {
  name?: string;
  profile?: {
    name: string;
    id: string;
  };
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, actionData?: { actionId: string; params: Record<string, unknown> }) => void;
  isLoading: boolean;
  sessionId: string;
  profileId?: string;
  profileData?: ProfileData;
  roleData?: RoleData;
  onRoleMatchFound?: (match: {
    id: string;
    name: string;
    matchPercentage: number;
    matchStatus: string;
    type: 'role' | 'profile';
  }) => void;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  isLoading,
  sessionId,
  profileId,
  profileData: initialProfileData,
  roleData: initialRoleData,
  onRoleMatchFound
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const [activeHeatmapModal, setActiveHeatmapModal] = useState<string | null>(null);
  const [loadingHeatmaps, setLoadingHeatmaps] = useState<{[key: string]: boolean}>({});
  const [roleData, setRoleData] = useState<RoleData | null>(initialRoleData || null);
  const [profileData, setProfileData] = useState<ProfileData | null>(initialProfileData || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [heatmapData, setHeatmapData] = useState<{[key: string]: CapabilityData[]}>({});
  const pendingRoleMatches = useRef<Array<{
    id: string;
    name: string;
    matchPercentage: number;
    matchStatus: string;
    type: 'role' | 'profile';
  }>>([]);

  // Update state when props change
  useEffect(() => {
    console.log('Props changed:', {
      initialProfileData,
      initialRoleData
    });
    
    if (initialRoleData) {
      setRoleData(initialRoleData);
    }
    if (initialProfileData) {
      setProfileData(initialProfileData);
    }
  }, [initialRoleData, initialProfileData]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set new height based on scrollHeight, with a max of 150px
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [inputValue]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle user scroll interaction
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (!hasUserInteracted) {
        setHasUserInteracted(true);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasUserInteracted]);

  useEffect(() => {
    // Only auto-scroll if:
    // 1. User has interacted with the chat (scrolled or sent a message)
    // 2. We have new messages
    // 3. The container is scrolled near the bottom already
    const shouldAutoScroll = () => {
      const container = messagesContainerRef.current;
      if (!container) return false;
      
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      return messages.length > prevMessagesLengthRef.current && (hasUserInteracted || isNearBottom);
    };

    if (shouldAutoScroll()) {
      scrollToBottom();
    }

    // If we have new messages and they're from the user, mark as interacted
    if (messages.length > prevMessagesLengthRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.sender === 'user') {
        setHasUserInteracted(true);
      }
    }
    
    prevMessagesLengthRef.current = messages.length;
  }, [messages, hasUserInteracted]);

  // Process any pending role matches after render
  useEffect(() => {
    if (pendingRoleMatches.current.length > 0) {
      pendingRoleMatches.current.forEach(match => {
        onRoleMatchFound?.(match);
      });
      pendingRoleMatches.current = [];
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      setHasUserInteracted(true); // Mark as interacted when user sends a message
      onSendMessage(inputValue.trim());

      // Prepare request body
      const requestBody = {
        action: 'postMessage',
        sessionId,
        message: inputValue.trim()
      };

      console.log('Sending chat request:', requestBody);

      // Make the API call
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const fetchHeatmapData = async (messageId: string, params: HeatmapRequestParams) => {
    setLoadingHeatmaps(prev => ({ ...prev, [messageId]: true }));
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch heatmap data: ${response.statusText}`);
      }

      const result: HeatmapResponse = await response.json();
      
      if (result.success && result.data.raw) {
        setHeatmapData(prev => ({
          ...prev,
          [messageId]: result.data.raw
        }));
      } else if (result.error) {
        console.error('Error fetching heatmap data:', result.error);
      }
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
    } finally {
      setLoadingHeatmaps(prev => ({ ...prev, [messageId]: false }));
    }
  };

  const isHeatmapMessage = (message: ChatMessage) => {
    if (!message.response_data) return false;
    
    const data = message.response_data as HeatmapRequestData;
    const heatmapTypes = [
      'generateCapabilityHeatmapByTaxonomy',
      'generateCapabilityHeatmapByDivision',
      'generateCapabilityHeatmapByRegion',
      'generateCapabilityHeatmapByCompany'
    ];

    return heatmapTypes.includes(data.insightId);
  };

  const handleHeatmapClick = (message: ChatMessage) => {
    const data = message.response_data as HeatmapRequestData;
    if (!heatmapData[message.id]) {
      fetchHeatmapData(message.id, {
        mode: data.mode,
        insightId: data.insightId,
        sessionId: data.sessionId,
        companyIds: data.companyIds
      });
    }
    setActiveHeatmapModal(message.id);
  };

  const getHeatmapGrouping = (insightId: string) => {
    switch (insightId) {
      case 'generateCapabilityHeatmapByTaxonomy':
        return 'taxonomy';
      case 'generateCapabilityHeatmapByDivision':
        return 'division';
      case 'generateCapabilityHeatmapByRegion':
        return 'region';
      case 'generateCapabilityHeatmapByCompany':
        return 'company';
      default:
        return 'taxonomy';
    }
  };

  const closeHeatmapModal = () => setActiveHeatmapModal(null);

  const handleActionButtonClick = async (actionData: ActionButtonData) => {
    try {
      // Log the incoming action data
      console.log('Action button clicked with data:', {
        actionId: actionData.actionId,
        params: actionData.params,
        profileId: actionData.params.profileId,
        roleId: actionData.params.roleId,
        profileData,
        roleData,
        context: roleData ? 'role' : 'profile'
      });

      // Get profile name from profileData if available
      const resolvedProfileName = roleData ? actionData.params.profileName : profileData?.profile?.name || profileData?.name;

      console.log('KKK Action data:', actionData);
      console.log('KKK Profile data:', profileData);
      console.log('KKK Role data:', roleData);
      // Generate natural language message based on action type
      let message = '';
      
      switch (actionData.actionId) {
        case 'getRoleDetails':
          message = `Can you tell me more about the ${actionData.params.roleTitle || (roleData?.title) || 'this role'} role?`;
          break;
        case 'getProfileContext':
          message = `Can you tell me more about ${resolvedProfileName || 'the candidate'}?`;
          break;
        case 'getCapabilityGaps':
          message = `What capability gaps are there between ${resolvedProfileName || 'the candidate'} and the ${actionData.params.roleTitle || (roleData?.title) || 'this role'} role?`;
          break;
        case 'getSemanticSkillRecommendations':
          message = `What skills should be developed for ${resolvedProfileName || 'the candidate'} to match the ${actionData.params.roleTitle || (roleData?.title) || 'this role'} role?`;
          break;
        case 'getDevelopmentPlan':
          message = `Can you create a development plan for ${resolvedProfileName || 'the candidate'} for the ${actionData.params.roleTitle || (roleData?.title) || 'this role'} role?`;
          break;
        case 'getReadinessAssessment':
          message = `What is ${resolvedProfileName || 'the candidate'}'s readiness for the ${actionData.params.roleTitle || (roleData?.title) || 'this role'} role?`;
          break;
        case 'explainMatch':
          message = `Can you explain how ${resolvedProfileName || 'the candidate'} matches the ${actionData.params.roleTitle || (roleData?.title) || 'this role'} role?`;
          break;
        default:
          message = `Can you ${actionData.label.toLowerCase()} for ${resolvedProfileName || 'the candidate'} regarding the ${actionData.params.roleTitle || (roleData?.title) || 'this role'} role?`;
      }

      // Add the message to the chat interface with action data
      setHasUserInteracted(true);
      onSendMessage(message, {
        actionId: actionData.actionId,
        params: {
          // Include role context
          ...(roleData && { roleId: roleData.id, roleTitle: roleData.title }),
          ...(actionData.params.roleId && { roleId: actionData.params.roleId }),
          ...(actionData.params.roleTitle && { roleTitle: actionData.params.roleTitle }),
          
          // Include profile context
          ...(profileData && resolvedProfileName && { 
            profileId, 
            profileName: resolvedProfileName 
          }),
          ...(actionData.params.profileId && { 
            profileId: actionData.params.profileId,
            profileName: actionData.params.profileName || resolvedProfileName || 'the candidate'
          })
        }
      });

      // Process role matches if needed
      if (actionData.params.roleId && actionData.params.roleTitle) {
        pendingRoleMatches.current.push({
          id: actionData.params.roleId,
          name: actionData.params.roleTitle,
          matchPercentage: actionData.params.matchPercentage || 0,
          matchStatus: actionData.params.matchStatus || 'now',
          type: 'role'
        });
      }
    } catch (error) {
      console.error('Error executing action:', error);
    }
  };

  const ActionButton = ({ data, isUserMessage }: { data: ActionButtonData; isUserMessage: boolean }) => {
    const baseClasses = "px-4 py-2 rounded-lg font-medium text-sm transition-colors";
    const variantClasses = {
      primary: isUserMessage 
        ? "bg-blue-700 hover:bg-blue-800 text-white" 
        : "bg-blue-600 hover:bg-blue-700 text-white",
      secondary: isUserMessage
        ? "bg-blue-200 hover:bg-blue-300 text-blue-900"
        : "bg-blue-100 hover:bg-blue-200 text-blue-800",
      outline: isUserMessage
        ? "border-2 border-blue-400 hover:bg-blue-100 text-blue-700"
        : "border-2 border-blue-500 hover:bg-blue-50 text-blue-600"
    };
    const sizeClasses = {
      small: "px-3 py-1 text-sm",
      medium: "px-4 py-2",
      large: "px-6 py-3 text-lg"
    };

    return (
      <button
        onClick={() => handleActionButtonClick(data)}
        className={`${baseClasses} ${variantClasses[data.variant || 'primary']} ${sizeClasses[data.size || 'medium']}`}
      >
        {data.label}
      </button>
    );
  };

  const ActionButtonGroup = ({ data, isUserMessage }: { data: ActionButtonGroupData; isUserMessage: boolean }) => {
    const baseButtonClasses = "px-4 py-2 font-medium text-sm transition-colors";
    const mainButtonClasses = isUserMessage 
      ? "bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
      : "bg-blue-500 hover:bg-blue-600 text-white rounded-lg";
    const dropdownItemClasses = isUserMessage
      ? "hover:bg-blue-50 text-gray-700"
      : "hover:bg-gray-50 text-gray-700";

    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className={`${baseButtonClasses} ${mainButtonClasses} flex items-center justify-between gap-2 min-w-[200px]`}
          >
            <span>{data.title}</span>
            <svg 
              className="w-4 h-4 transition-transform" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-[9999] w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100"
            sideOffset={5}
          >
            {data.actions.map((action) => (
              <DropdownMenu.Item
                key={action.actionId}
                onSelect={() => handleActionButtonClick(action)}
                className={`${baseButtonClasses} ${dropdownItemClasses} w-full text-left flex items-center outline-none cursor-pointer`}
              >
                {(action.actionId === 'getRoleDetails' || action.actionId === 'getProfileContext') && (
                  <InformationCircleIcon className="mr-3 h-5 w-5 text-gray-400" />
                )}
                {action.actionId === 'getCapabilityGaps' && (
                  <ChartBarIcon className="mr-3 h-5 w-5 text-gray-400" />
                )}
                {action.actionId === 'getSemanticSkillRecommendations' && (
                  <LightBulbIcon className="mr-3 h-5 w-5 text-gray-400" />
                )}
                {action.actionId === 'explainMatch' && (
                  <DocumentMagnifyingGlassIcon className="mr-3 h-5 w-5 text-gray-400" />
                )}
                {action.actionId === 'getReadinessAssessment' && (
                  <ClipboardIcon className="mr-3 h-5 w-5 text-gray-400" />
                )}
                {action.actionId === 'getDevelopmentPlan' && (
                  <ClipboardDocumentCheckIcon className="mr-3 h-5 w-5 text-gray-400" />
                )}
                <span>{action.label}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    );
  };

  const processActionButtons = (content: string) => {
    try {
      const actionData = JSON.parse(content);
      
      // Schedule match processing for next tick to avoid render phase updates
      const processMatch = (match: { 
        id: string; 
        name: string; 
        matchPercentage: number; 
        matchStatus: string; 
        type: 'role' | 'profile';
      }) => {
        setTimeout(() => {
          console.log('Adding match:', { name: match.name, type: match.type });
          onRoleMatchFound?.(match);
        }, 0);
      };

      interface ActionParams {
        roleId?: string;
        roleTitle?: string;
        profileId?: string;
        profileName?: string;
        name?: string;
        matchPercentage?: number;
        semanticScore?: number;
      }

      const processParams = (params: ActionParams) => {
        if (params.roleId) {
          // This is a role match
          processMatch({
            id: params.roleId,
            name: params.roleTitle || 'Unknown Role',
            matchPercentage: params.matchPercentage || 100,
            matchStatus: 'Candidate',
            type: 'role'
          });
        } else if (params.profileId) {
          // This is a profile match
          const name = params.profileName || params.name || 'Unknown Profile';
          const matchPercentage = params.matchPercentage || 
            (typeof params.semanticScore === 'number' ? params.semanticScore * 100 : 83);

          processMatch({
            id: params.profileId,
            name: name,
            matchPercentage: matchPercentage,
            matchStatus: 'Candidate',
            type: 'profile'
          });
        }
      };
      
      // Handle both array of actions and single action
      if (Array.isArray(actionData)) {
        actionData.forEach(action => {
          if (action.params) {
            processParams(action.params);
          }
        });
      } else if (actionData.params) {
        processParams(actionData.params);
      }

      return actionData;
    } catch (error) {
      console.error('Failed to process action buttons:', error);
      return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Messages Area */}
      <div 
        data-chat-container
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 mb-[76px]"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className={`prose prose-sm max-w-none overflow-x-auto ${
                message.sender === 'user' 
                  ? 'prose-invert prose-p:text-white prose-li:text-white prose-headings:text-white prose-a:text-white hover:prose-a:text-blue-100' 
                  : ''
              }`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: (props) => <h1 className={`text-2xl font-bold mt-0 mb-4 ${message.sender === 'user' ? 'text-white' : 'text-blue-900'}`} {...props} />,
                    h2: (props) => <h2 className={`text-xl font-bold mt-6 mb-3 ${message.sender === 'user' ? 'text-white' : 'text-blue-800'}`} {...props} />,
                    h3: (props) => <h3 className={`text-lg font-semibold mt-4 mb-2 ${message.sender === 'user' ? 'text-white' : 'text-blue-700'}`} {...props} />,
                    p: (props) => <p className={`mt-0 mb-3 leading-relaxed ${message.sender === 'user' ? 'text-white' : 'text-gray-700'}`} {...props} />,
                    ul: (props) => <ul className="list-disc list-inside mt-2 mb-3 space-y-1" {...props} />,
                    ol: (props) => <ol className="list-decimal list-inside mt-2 mb-3 space-y-1" {...props} />,
                    li: (props) => <li className={message.sender === 'user' ? 'text-white' : 'text-gray-700'} {...props} />,
                    table: (props) => <div className="overflow-x-auto my-4"><table className={`min-w-full border-collapse ${message.sender === 'user' ? 'border-white/30' : 'border-gray-300'}`} {...props} /></div>,
                    th: (props) => <th className={`text-left p-3 font-semibold ${message.sender === 'user' ? 'bg-blue-700 text-white border-white/30' : 'bg-gray-50 text-gray-700 border-gray-300'}`} {...props} />,
                    td: (props) => <td className={`p-3 ${message.sender === 'user' ? 'text-white border-white/30' : 'text-gray-700 border-gray-300'}`} {...props} />,
                    hr: (props) => <hr className={`my-6 border-t ${message.sender === 'user' ? 'border-white/30' : 'border-gray-200'}`} {...props} />,
                    a: (props) => <a className={message.sender === 'user' ? 'text-white hover:text-blue-100 underline' : 'text-blue-600 hover:text-blue-800 underline'} {...props} />,
                    code: ({inline, className, children, ...props}: {inline?: boolean; className?: string; children?: React.ReactNode} & React.HTMLProps<HTMLElement>) => {
                      const content = String(children || '').trim();
                      
                      if (className === 'language-action') {
                        const actionData = processActionButtons(content);
                        if (!actionData) return <code {...props}>{children}</code>;
                        
                        // Check if it's a group of actions
                        if (Array.isArray(actionData) && actionData.length > 0 && actionData[0].groupId) {
                          // Group actions by groupId
                          const groupedActions = actionData.reduce((groups: Record<string, ActionButtonData[]>, action) => {
                            const groupId = action.groupId || 'default';
                            if (!groups[groupId]) {
                              groups[groupId] = [];
                            }
                            groups[groupId].push(action);
                            return groups;
                          }, {});

                          // Render each group
                          return (
                            <div className="space-y-2">
                              {Object.entries(groupedActions).map(([groupId, actions]) => (
                                <ActionButtonGroup
                                  key={groupId}
                                  data={{
                                    groupId: String(groupId),
                                    title: String(actions[0].params.roleTitle || 'Actions'),
                                    actions
                                  }}
                                  isUserMessage={message.sender === 'user'}
                                />
                              ))}
                            </div>
                          );
                        }
                        
                        // Single action button
                        return <ActionButton data={actionData} isUserMessage={message.sender === 'user'} />;
                      }
                      return inline ? (
                        <code className={`rounded px-1.5 py-0.5 text-sm font-mono ${message.sender === 'user' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-800'}`} {...props}>
                          {children}
                        </code>
                      ) : (
                        <code className={`block rounded p-3 text-sm font-mono overflow-x-auto ${message.sender === 'user' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-800'}`} {...props}>
                          {children}
                        </code>
                      );
                    },
                    pre: (props) => <pre className={`rounded p-3 overflow-x-auto font-mono ${message.sender === 'user' ? 'bg-blue-700 text-white' : 'bg-gray-100'}`} {...props} />,
                    blockquote: (props) => <blockquote className={`border-l-4 p-4 my-4 ${message.sender === 'user' ? 'border-white/50 bg-blue-700 text-white' : 'border-blue-500 bg-blue-50 text-gray-700'}`} {...props} />,
                  }}
                >
                  {message.message}
                </ReactMarkdown>
              </div>

              {isHeatmapMessage(message) && (
                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => handleHeatmapClick(message)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      message.sender === 'user'
                        ? 'bg-blue-700 hover:bg-blue-800 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    }`}
                    disabled={loadingHeatmaps[message.id]}
                  >
                    {loadingHeatmaps[message.id] ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Loading Heatmap...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        View Capability Heatmap
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Heatmap Modal */}
              {activeHeatmapModal === message.id && (
                <HeatmapModal
                  isOpen={true}
                  onClose={closeHeatmapModal}
                  data={heatmapData[message.id] || []}
                  groupBy={getHeatmapGrouping((message.response_data as HeatmapRequestData).insightId)}
                />
              )}

              {message.followUpQuestion && (
                <div className={`mt-3 pt-3 border-t ${message.sender === 'user' ? 'border-white/30' : 'border-gray-200'}`}>
                  <p className={`text-sm ${message.sender === 'user' ? 'text-white/90' : 'text-gray-600'}`}>{message.followUpQuestion}</p>
                </div>
              )}
              {message.semanticContext && (
                <div className="mt-2 text-sm text-gray-500">
                  {message.semanticContext.relevantText && (
                    <p>Relevant: {message.semanticContext.relevantText}</p>
                  )}
                  {message.semanticContext.confidence && (
                    <p>Confidence: {Math.round(message.semanticContext.confidence * 100)}%</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="fixed max-w-[766px] bottom-0 left-1/2 -translate-x-1/2 right-0 border-t border-gray-200 p-4 bg-white rounded-b-2xl" style={{ width: 'inherit' }}>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="w-full resize-none rounded-lg bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900 placeholder:text-gray-500 text-sm py-2 px-3 min-h-[40px] max-h-[150px] selection:bg-blue-100"
              rows={1}
            />
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
} 