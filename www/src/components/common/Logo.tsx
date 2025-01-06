import Link from 'next/link';

export function Logo() {
  return (
    <div className="flex items-center">
      <img 
        src="/assets/logos/awai-logo.svg" 
        alt="Accelerate with AI" 
        className="h-12 w-auto"
      />
    </div>
  );
} 