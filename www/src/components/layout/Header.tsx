'use client';

import { Logo } from '../common/Logo';
import Link from 'next/link';
import { useState } from 'react';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-transparent absolute top-0 left-0 right-0 z-10" role="banner">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
            <Link 
              href="/hubspot-setup" 
              className="text-white hover:text-gray-200 transition-colors"
            >
              Setup Guide
            </Link>
            <Link 
              href="/pricing" 
              className="text-white hover:text-gray-200 transition-colors"
            >
              Pricing
            </Link>
            <Link 
              href="/partner" 
              className="text-white hover:text-gray-200 transition-colors"
            >
              Partner Program
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden mt-4 py-4 border-t border-white/20" aria-label="Mobile navigation">
            <div className="flex flex-col gap-4">
              <Link 
                href="/hubspot-setup" 
                className="text-white hover:text-gray-200 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Setup Guide
              </Link>
              <Link 
                href="/pricing" 
                className="text-white hover:text-gray-200 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link 
                href="/partner" 
                className="text-white hover:text-gray-200 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Partner Program
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}