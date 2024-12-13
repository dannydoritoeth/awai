import { Logo } from '../common/Logo';
import Link from 'next/link';

export function ContactHeader() {
  return (
    <header className="fixed w-full bg-white z-50 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <nav className="flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-gray-900">
            AccelerateWith.ai
          </Link>
          
          {/* Free Content Dropdown */}
          <div className="relative group">
            <button className="flex items-center space-x-1 text-gray-700 hover:text-gray-900">
              <span>Free Content</span>
              <svg 
                className="w-4 h-4 transition-transform group-hover:rotate-180" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="py-1">
                <Link 
                  href="https://www.youtube.com/@scott.bradley.16940" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  YouTube
                </Link>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
} 