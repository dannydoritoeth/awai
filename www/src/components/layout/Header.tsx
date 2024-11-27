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
            <a 
              href="#services" 
              className="text-2xl text-gray-700 hover:text-gray-900 transition-colors"
            >
              Services
            </a>
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