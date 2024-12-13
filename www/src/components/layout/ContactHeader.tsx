import { Logo } from '../common/Logo';
import Link from 'next/link';

export function ContactHeader() {
  return (
    <header className="fixed w-full top-0 z-50 bg-white">
      <div className="container mx-auto px-8 py-4">
        <div className="flex justify-center">
          <Link href="/">
            <img
              src="/assets/logos/awai-logo.svg"
              alt="Accelerate with AI Logo"
              className="w-[360px] h-[120px]"
            />
          </Link>
        </div>
      </div>
    </header>
  );
} 