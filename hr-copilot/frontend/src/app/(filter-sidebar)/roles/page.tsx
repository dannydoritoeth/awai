'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getRoles, type Role } from '@/lib/services/roles';

export default function RolesPage() {
  const searchParams = useSearchParams();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRoles() {
      try {
        setLoading(true);
        const filters = {
          taxonomy: searchParams.get('taxonomy') || undefined,
          band: searchParams.get('band') || undefined,
          agency: searchParams.get('agency') || undefined,
        };
        const data = await getRoles(filters);
        setRoles(data);
      } catch (error) {
        console.error('Error loading roles:', error);
      } finally {
        setLoading(false);
      }
    }
    loadRoles();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8 text-gray-900">Roles</h1>
      
      <div className="grid gap-6">
        {roles.map((role) => (
          <Link 
            key={role.id} 
            href={`/roles/${role.id}`}
            className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-500 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{role.title}</h2>
                <p className="text-gray-600 mb-4">{role.summary}</p>
                <div className="flex gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {role.band}
                  </span>
                  {role.agencies.map((agency) => (
                    <span 
                      key={agency}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {agency}
                    </span>
                  ))}
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </Link>
        ))}

        {roles.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No roles found</h3>
            <p className="text-gray-600">Try adjusting your filters to see more results.</p>
          </div>
        )}
      </div>
    </div>
  );
} 