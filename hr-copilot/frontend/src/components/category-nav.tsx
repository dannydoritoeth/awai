'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const categories = [
  { name: 'Institutions', href: '/institutions' },
  { name: 'Companies', href: '/companies' },
  { name: 'Divisions', href: '/divisions' },
  { name: 'Career Type', href: '/taxonomies' },
  { name: 'Capabilities', href: '/capabilities' },
  { name: 'Skills', href: '/skills' },
  { name: 'Roles', href: '/roles' },
];

export function CategoryNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b">
      <div className="flex justify-between px-8">
        {categories.map((category) => {
          const isActive = pathname.startsWith(category.href);
          
          return (
            <Link
              key={category.href}
              href={category.href}
              className={cn(
                'py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
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