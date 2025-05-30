'use client';

import { useEffect, useState } from 'react';
import { getCategories, type CategoryWithStats } from '@/lib/services/categories';
import CategoryCard from '@/app/components/CategoryCard';

export default function TaxonomiesPage() {
  const [categories, setCategories] = useState<CategoryWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      try {
        setLoading(true);
        const data = await getCategories('taxonomy');
        setCategories(data);
      } catch (error) {
        console.error('Error loading taxonomies:', error);
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 bg-gray-100 rounded-lg"></div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Career Types</h1>
      <p className="text-gray-600 mb-8">Explore roles by function or theme across NSW Government</p>
      
      <div className="grid gap-6">
        {categories.map((category) => (
          <CategoryCard 
            key={category.id} 
            category={category}
            type="taxonomy"
          />
        ))}

        {categories.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
            <p className="text-gray-600">Please try again later.</p>
          </div>
        )}
      </div>
    </div>
  );
} 