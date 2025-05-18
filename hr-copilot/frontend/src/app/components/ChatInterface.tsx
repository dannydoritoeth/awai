'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '@/types/chat';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  isLoading
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div 
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
                    code: ({inline, ...props}: {inline?: boolean} & React.HTMLProps<HTMLElement>) => 
                      inline ? (
                        <code className={`rounded px-1.5 py-0.5 text-sm font-mono ${message.sender === 'user' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-800'}`} {...props} />
                      ) : (
                        <code className={`block rounded p-3 text-sm font-mono overflow-x-auto ${message.sender === 'user' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-800'}`} {...props} />
                      ),
                    pre: (props) => <pre className={`rounded p-3 overflow-x-auto font-mono ${message.sender === 'user' ? 'bg-blue-700 text-white' : 'bg-gray-100'}`} {...props} />,
                    blockquote: (props) => <blockquote className={`border-l-4 p-4 my-4 ${message.sender === 'user' ? 'border-white/50 bg-blue-700 text-white' : 'border-blue-500 bg-blue-50 text-gray-700'}`} {...props} />,
                  }}
                >
                  {message.message}
                </ReactMarkdown>
              </div>
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