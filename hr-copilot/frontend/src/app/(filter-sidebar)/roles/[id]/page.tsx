'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getRole, type Role } from '@/lib/services/roles';

interface RoleWithTransitions extends Role {
  transitions: {
    to_role_id: string;
    from_role_id: string;
    frequency: number;
  }[];
}

export default function RoleDetailPage() {
  const params = useParams();
  const [role, setRole] = useState<RoleWithTransitions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRole() {
      try {
        setLoading(true);
        const data = await getRole(params.id as string);
        setRole(data);
      } catch (error) {
        console.error('Error loading role:', error);
      } finally {
        setLoading(false);
      }
    }
    loadRole();
  }, [params.id]);

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-100 rounded w-2/3 mb-8"></div>
        <div className="space-y-4">
          <div className="h-4 bg-gray-100 rounded"></div>
          <div className="h-4 bg-gray-100 rounded"></div>
          <div className="h-4 bg-gray-100 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-medium text-gray-900 mb-2">Role not found</h2>
        <p className="text-gray-600 mb-4">The role you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/roles" className="text-blue-600 hover:text-blue-800">
          Back to all roles
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/roles" className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to all roles
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{role.title}</h1>
          <div className="flex gap-2 mb-6">
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
          <p className="text-gray-600">{role.summary}</p>
        </div>

        <div className="prose max-w-none">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
          <div className="text-gray-600 whitespace-pre-wrap">{role.description}</div>
        </div>

        {role.transitions.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Common Transitions</h2>
            <div className="grid gap-4">
              {role.transitions.map((transition) => (
                <Link
                  key={transition.to_role_id}
                  href={`/roles/${transition.to_role_id}`}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <span className="text-gray-900">{transition.to_role_id}</span>
                  <span className="text-sm text-gray-500">{transition.frequency} transitions</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 