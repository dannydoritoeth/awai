import { TrendingUp } from 'lucide-react';
import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center space-x-2">
      <TrendingUp className="w-8 h-8 text-blue-900" />
      <span className="font-bold text-xl text-blue-900">Accelerate with AI</span>
    </Link>
  );
}