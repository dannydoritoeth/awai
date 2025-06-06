'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const categories = [
  { name: 'Institutions', href: '/institutions' },
  { name: 'Organizations', href: '/companies' },
  { name: 'Career Type', href: '/taxonomies' },
  { name: 'Capabilities', href: '/capabilities' },
  { name: 'Skills', href: '/skills' },
  { name: 'Roles', href: '/roles' },
];

export function CategoryNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b">
      <div className="flex px-4 py-2 space-x-4 justify-start">
        {categories.map((category) => {
          const isActive = pathname.startsWith(category.href);

          return (
            <Link
              key={category.href}
              href={category.href}
              className={cn(
                'text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {category.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
