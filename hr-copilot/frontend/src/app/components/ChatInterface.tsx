'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, HeatmapRequestData } from '@/types/chat';
import { CapabilityData } from './CapabilityHeatmap';
import HeatmapModal from './HeatmapModal';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

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

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  sessionId: string;
  profileId?: string;
  onRoleMatchFound?: (match: {
    id: string;
    name: string;
    matchPercentage: number;
    matchStatus: string;
  }) => void;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  isLoading,
  sessionId,
  profileId,
  onRoleMatchFound
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const [activeHeatmapModal, setActiveHeatmapModal] = useState<string | null>(null);
  const [loadingHeatmaps, setLoadingHeatmaps] = useState<{[key: string]: boolean}>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [heatmapData, setHeatmapData] = useState<{[key: string]: CapabilityData[]}>({});

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
      return hasUserInteracted && messages.length > prevMessagesLengthRef.current && isNearBottom;
    };

    if (shouldAutoScroll()) {
      scrollToBottom();
    }
    
    prevMessagesLengthRef.current = messages.length;
  }, [messages, hasUserInteracted]);

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
        profileId: actionData.params.profileId
      });

      // Generate natural language message based on action type
      let message = '';
      const roleTitle = actionData.params.roleTitle || 'this role';
      
      switch (actionData.actionId) {
        case 'getRoleDetails':
          message = `Can you tell me more about ${roleTitle}?`;
          break;
        case 'getCapabilityGaps':
          message = `What capability gaps do I have for ${roleTitle}?`;
          break;
        case 'getSemanticSkillRecommendations':
          message = `What skills should I develop for ${roleTitle}?`;
          break;
        case 'getDevelopmentPlan':
          message = `Can you create a development plan for ${roleTitle}?`;
          break;
        default:
          message = `Can you ${actionData.label.toLowerCase()} for ${roleTitle}?`;
      }

      // Send the natural language message to continue the conversation
      onSendMessage(message);

      // Prepare flattened request body
      const requestBody = {
        action: 'postMessage',
        sessionId,
        message,
        actionId: actionData.actionId,
        roleId: actionData.params.roleId,
        roleTitle: actionData.params.roleTitle,
        ...(profileId && { profileId })
      };

      console.log('Sending action request with full details:', {
        requestBody,
        hasProfileId: !!profileId,
        profileIdValue: profileId
      });

      // Execute the action through chat endpoint
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Failed to execute action: ${response.statusText}`);
      }

      await response.json();

      if (actionData.params.roleId && actionData.params.roleTitle) {
        onRoleMatchFound?.({
          id: actionData.params.roleId,
          name: actionData.params.roleTitle,
          matchPercentage: actionData.params.matchPercentage || 0,
          matchStatus: actionData.params.matchStatus || 'now'
        });
      }
    } catch (error) {
      console.error('Error executing action:', error);
      // Optionally show an error message to the user
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
                {action.actionId === 'getRoleDetails' && (
                  <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {action.actionId === 'getCapabilityGaps' && (
                  <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                )}
                {action.actionId === 'getSemanticSkillRecommendations' && (
                  <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                )}
                {action.actionId === 'getDevelopmentPlan' && (
                  <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
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
      
      // If it's an array of actions, process each one
      if (Array.isArray(actionData)) {
        actionData.forEach(action => {
          if (action.params.roleId && action.params.roleTitle) {
            onRoleMatchFound?.({
              id: action.params.roleId,
              name: action.params.roleTitle,
              matchPercentage: action.params.matchPercentage || 0,
              matchStatus: action.params.matchStatus || 'now'
            });
          }
        });
      } 
      // If it's a single action
      else if (actionData.params?.roleId && actionData.params?.roleTitle) {
        onRoleMatchFound?.({
          id: actionData.params.roleId,
          name: actionData.params.roleTitle,
          matchPercentage: actionData.params.matchPercentage || 0,
          matchStatus: actionData.params.matchStatus || 'now'
        });
      }
      return actionData;
    } catch (error) {
      console.error('Failed to parse action button data:', error);
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