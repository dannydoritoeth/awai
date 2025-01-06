'use client';

import { Logo } from '../common/Logo';

export function Header() {
  return (
    <header className="bg-white">
      <div className="container mx-auto px-8 py-6">
        <div className="flex items-center justify-between">
          <Logo />
        </div>
      </div>
    </header>
  );
}