'use client';

import { Logo } from '../common/Logo';

export function Header() {
  return (
    <header className="bg-transparent absolute top-0 left-0 right-0 z-10">
      <div className="container mx-auto px-8 py-6">
        <div className="flex items-center justify-between">
          <Logo />
        </div>
      </div>
    </header>
  );
}