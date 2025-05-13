'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  isAI: boolean;
}

export default function TypewriterText({ 
  text, 
  speed = 30, 
  onComplete,
  isAI
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  
  // Get environment variables (with fallbacks)
  const enableStreaming = process.env.NEXT_PUBLIC_ENABLE_MESSAGE_STREAMING !== 'false';
  const typingSpeed = process.env.NEXT_PUBLIC_TYPEWRITER_SPEED ? 
    parseInt(process.env.NEXT_PUBLIC_TYPEWRITER_SPEED, 10) : 
    speed;

  useEffect(() => {
    // Reset when the text changes
    setDisplayedText('');
    setIsComplete(false);
    
    // If not an AI message, or streaming is disabled, display immediately
    if (!isAI || !enableStreaming) {
      setDisplayedText(text);
      setIsComplete(true);
      onComplete?.();
      return;
    }
    
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(prev => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
        setIsComplete(true);
        onComplete?.();
      }
    }, typingSpeed);

    return () => clearInterval(timer);
  }, [text, typingSpeed, onComplete, isAI, enableStreaming]);

  // Display the markdown only when text is complete
  if (isAI) {
    return (
      <div className={`text-sm whitespace-pre-wrap prose prose-sm max-w-none prose-headings:mb-2 prose-headings:mt-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0`}>
        {isComplete ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (props) => <h1 className="text-lg font-bold" {...props} />,
              h2: (props) => <h2 className="text-base font-bold" {...props} />,
              h3: (props) => <h3 className="text-base font-bold" {...props} />,
              a: (props) => <a className="underline" {...props} />,
              ul: (props) => <ul className="list-disc list-inside" {...props} />,
              ol: (props) => <ol className="list-decimal list-inside" {...props} />,
            }}
          >
            {text}
          </ReactMarkdown>
        ) : (
          <span>{displayedText}</span>
        )}
      </div>
    );
  } else {
    // User messages don't need the typewriter effect
    return (
      <div className={`text-sm whitespace-pre-wrap prose-invert prose-sm max-w-none prose-headings:mb-2 prose-headings:mt-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: (props) => <h1 className="text-lg font-bold" {...props} />,
            h2: (props) => <h2 className="text-base font-bold" {...props} />,
            h3: (props) => <h3 className="text-base font-bold" {...props} />,
            a: (props) => <a className="underline" {...props} />,
            ul: (props) => <ul className="list-disc list-inside" {...props} />,
            ol: (props) => <ol className="list-decimal list-inside" {...props} />,
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  }
} 