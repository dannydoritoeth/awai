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

  useEffect(() => {
    let currentIndex = 0;
    let timer: NodeJS.Timeout;

    const typeNextCharacter = () => {
      if (currentIndex < text.length) {
        setDisplayedText(text.substring(0, currentIndex + 1));
        currentIndex++;
        timer = setTimeout(typeNextCharacter, speed);
      } else {
        setIsComplete(true);
        if (onComplete) {
          onComplete();
        }
      }
    };

    // Reset state when text changes
    setDisplayedText('');
    setIsComplete(false);
    currentIndex = 0;

    // Start typing
    timer = setTimeout(typeNextCharacter, speed);

    // Cleanup
    return () => {
      clearTimeout(timer);
    };
  }, [text, speed, onComplete]);

  // Display the markdown only when text is complete
  if (isAI) {
    return (
      <div className={`text-sm whitespace-pre-wrap prose prose-sm max-w-none overflow-x-auto prose-headings:mb-2 prose-headings:mt-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0`}>
        {isComplete ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (props) => <h1 className="text-lg font-bold mt-0 mb-2" {...props} />,
              h2: (props) => <h2 className="text-base font-bold mt-0 mb-2" {...props} />,
              h3: (props) => <h3 className="text-base font-semibold mt-0 mb-1" {...props} />,
              p: (props) => <p className="mt-0 mb-2 last:mb-0" {...props} />,
              ul: (props) => <ul className="list-disc list-inside mt-0 mb-2" {...props} />,
              ol: (props) => <ol className="list-decimal list-inside mt-0 mb-2" {...props} />,
              li: (props) => <li className="mt-0 mb-1" {...props} />,
              a: (props) => <a className="text-blue-500 hover:text-blue-600 underline" {...props} />,
              code: ({inline, ...props}: {inline?: boolean} & React.HTMLProps<HTMLElement>) => 
                inline ? (
                  <code className="bg-gray-200 rounded px-1 py-0.5 text-sm" {...props} />
                ) : (
                  <code className="block bg-gray-200 rounded p-2 text-sm overflow-x-auto" {...props} />
                ),
              pre: (props) => <pre className="bg-gray-200 rounded p-2 overflow-x-auto" {...props} />,
              blockquote: (props) => <blockquote className="border-l-4 border-gray-300 pl-4 italic" {...props} />,
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
      <div className={`text-sm whitespace-pre-wrap prose-invert prose-sm max-w-none overflow-x-auto prose-headings:mb-2 prose-headings:mt-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: (props) => <h1 className="text-lg font-bold mt-0 mb-2" {...props} />,
            h2: (props) => <h2 className="text-base font-bold mt-0 mb-2" {...props} />,
            h3: (props) => <h3 className="text-base font-semibold mt-0 mb-1" {...props} />,
            p: (props) => <p className="mt-0 mb-2 last:mb-0" {...props} />,
            ul: (props) => <ul className="list-disc list-inside mt-0 mb-2" {...props} />,
            ol: (props) => <ol className="list-decimal list-inside mt-0 mb-2" {...props} />,
            li: (props) => <li className="mt-0 mb-1" {...props} />,
            a: (props) => <a className="text-blue-500 hover:text-blue-600 underline" {...props} />,
            code: ({inline, ...props}: {inline?: boolean} & React.HTMLProps<HTMLElement>) => 
              inline ? (
                <code className="bg-gray-200 rounded px-1 py-0.5 text-sm" {...props} />
              ) : (
                <code className="block bg-gray-200 rounded p-2 text-sm overflow-x-auto" {...props} />
              ),
            pre: (props) => <pre className="bg-gray-200 rounded p-2 overflow-x-auto" {...props} />,
            blockquote: (props) => <blockquote className="border-l-4 border-gray-300 pl-4 italic" {...props} />,
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    );
  }
} 