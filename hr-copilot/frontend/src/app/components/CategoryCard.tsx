'use client';

import Link from 'next/link';
import type { CategoryWithStats } from '@/lib/services/categories';

interface CategoryCardProps {
  category: CategoryWithStats;
  type: 'taxonomy' | 'skill' | 'capability';
}

export default function CategoryCard({ category, type }: CategoryCardProps) {
  const getHref = (type: 'taxonomy' | 'skill' | 'capability') => {
    switch (type) {
      case 'taxonomy':
        return `/taxonomies/${category.id}`;
      case 'skill':
        return `/skills/${category.id}`;
      case 'capability':
        return `/capabilities/${category.id}`;
      default:
        return `/${type}/${category.id}`;
    }
  };

  return (
    <Link href={getHref(type)} className="block">
      <div className="p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold text-gray-900">{category.name}</h3>
          {category.taxonomy_type && (
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
              {category.taxonomy_type}
            </span>
          )}
        </div>
        
        {category.description && (
          <p className="text-gray-700 mb-4">{category.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Total Roles</p>
            <p className="text-2xl font-semibold text-blue-600">{category.role_count || '--'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Divisions</p>
            <p className="text-2xl font-semibold text-blue-600">
              {category.divisions?.length || '--'}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
} 