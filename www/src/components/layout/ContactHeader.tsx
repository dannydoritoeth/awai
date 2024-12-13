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
          
          <div className="flex items-center space-x-8">
            <Link 
              href="https://www.youtube.com/@scott.bradley.16940" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-gray-900"
            >
              Free Content
            </Link>
            <Link href="/services" className="text-gray-700 hover:text-gray-900">
              Services
            </Link>
            <Link href="/contact" className="text-gray-700 hover:text-gray-900">
              Contact Us
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
} 