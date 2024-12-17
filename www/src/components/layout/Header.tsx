'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from '../common/Logo';
import Link from 'next/link';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed w-full top-0 z-50 bg-white">
      <div className="container mx-auto px-8 py-4">
        <div className="flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-16">
            <Link 
              href="/services" 
              className="text-2xl text-gray-700 hover:text-gray-900 transition-colors"
            >
              Services
            </Link>
            
            {/* Free Content Dropdown */}
            <div className="relative group">
              <button className="text-2xl text-gray-700 hover:text-gray-900 transition-colors flex items-center gap-2">
                Free Content
                <svg 
                  className="w-5 h-5 transition-transform group-hover:rotate-180" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible 
                group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <div className="py-1">
                  <Link 
                    href="https://www.youtube.com/@scott.bradley.16940" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-lg text-gray-700 hover:bg-gray-100"
                  >
                    YouTube
                  </Link>
                </div>
              </div>
            </div>

            <Link 
              href="/contact" 
              className="text-2xl px-6 py-2 bg-[#0A2E4D] text-white rounded-md 
                hover:bg-[#164875] transition-colors duration-300 
                shadow-lg hover:shadow-xl"
            >
              Contact Us
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link 
      href={href}
      className="text-xl font-semibold text-gray-700 hover:text-blue-900 transition-colors"
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link 
      href={href}
      className="text-xl font-semibold text-gray-700 hover:text-blue-900 transition-colors block py-3"
    >
      {children}
    </Link>
  );
}