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
      <div className={`text-sm whitespace-pre-wrap prose prose-sm max-w-none overflow-x-auto
        prose-headings:mb-3 prose-headings:mt-4 first:prose-headings:mt-0
        prose-p:my-2 prose-ul:my-2 prose-li:my-1
        prose-hr:my-6 prose-hr:border-gray-200
        prose-table:my-4 prose-th:p-2 prose-td:p-2 prose-table:border-collapse prose-table:border prose-td:border prose-th:border
        prose-th:bg-gray-50 prose-th:text-gray-700
        prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:p-4 prose-blockquote:my-4
        `}>
        {isComplete ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (props) => <h1 className="text-2xl font-bold mt-0 mb-4 text-blue-900" {...props} />,
              h2: (props) => <h2 className="text-xl font-bold mt-6 mb-3 text-blue-800" {...props} />,
              h3: (props) => <h3 className="text-lg font-semibold mt-4 mb-2 text-blue-700" {...props} />,
              p: (props) => <p className="mt-0 mb-3 text-gray-700 leading-relaxed" {...props} />,
              ul: (props) => <ul className="list-disc list-inside mt-2 mb-3 space-y-1" {...props} />,
              ol: (props) => <ol className="list-decimal list-inside mt-2 mb-3 space-y-1" {...props} />,
              li: (props) => <li className="text-gray-700" {...props} />,
              table: (props) => <div className="overflow-x-auto my-4"><table className="min-w-full border-collapse border border-gray-300" {...props} /></div>,
              th: (props) => <th className="bg-gray-50 text-left p-3 border border-gray-300 font-semibold text-gray-700" {...props} />,
              td: (props) => <td className="p-3 border border-gray-300 text-gray-700" {...props} />,
              hr: (props) => <hr className="my-6 border-t border-gray-200" {...props} />,
              a: (props) => <a className="text-blue-600 hover:text-blue-800 underline" {...props} />,
              code: ({inline, ...props}: {inline?: boolean} & React.HTMLProps<HTMLElement>) => 
                inline ? (
                  <code className="bg-gray-100 rounded px-1.5 py-0.5 text-sm font-mono text-gray-800" {...props} />
                ) : (
                  <code className="block bg-gray-100 rounded p-3 text-sm font-mono text-gray-800 overflow-x-auto" {...props} />
                ),
              pre: (props) => <pre className="bg-gray-100 rounded p-3 overflow-x-auto font-mono" {...props} />,
              blockquote: (props) => <blockquote className="border-l-4 border-blue-500 bg-blue-50 p-4 my-4 text-gray-700" {...props} />,
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