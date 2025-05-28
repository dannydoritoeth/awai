'use client';

import Link from 'next/link';
import type { CategoryWithStats } from '@/lib/services/categories';

interface CategoryCardProps {
  category: CategoryWithStats;
  type: 'taxonomy' | 'skill' | 'capability';
}

export default function CategoryCard({ category, type }: CategoryCardProps) {
  return (
    <Link 
      href={`/${type}s/${category.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-500 transition-colors"
    >
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{category.name}</h2>
          <p className="text-gray-600 mb-4">{category.description}</p>
          <div className="flex gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {category.role_count} roles
            </span>
            {category.divisions.slice(0, 3).map((division) => (
              <span 
                key={division}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                {division}
              </span>
            ))}
            {category.divisions.length > 3 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                +{category.divisions.length - 3} more
              </span>
            )}
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    </Link>
  );
} 