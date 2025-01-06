'use client';

import { Logo } from '../common/Logo';
import Link from 'next/link';

export function Header() {
  return (
    <header className="bg-white">
      <div className="container mx-auto px-8 py-6">
        <div className="flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8">
            <a 
              href="#solution"
              className="text-lg text-gray-700 hover:text-gray-900 transition-colors"
            >
              Solution
            </a>
            <a 
              href="#benefits"
              className="text-lg text-gray-700 hover:text-gray-900 transition-colors"
            >
              Benefits
            </a>
            <a 
              href="#guarantee"
              className="text-lg text-gray-700 hover:text-gray-900 transition-colors"
            >
              Guarantee
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}