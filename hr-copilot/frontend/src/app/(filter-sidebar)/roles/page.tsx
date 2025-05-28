'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { getRoles, type Role } from '@/lib/services/roles';

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'specific'>('general');

  useEffect(() => {
    const loadRoles = async () => {
      try {
        setLoading(true);
        const data = await getRoles({ type: activeTab });
        setRoles(data || []);
      } catch (err) {
        console.error('Error loading roles:', err);
        setError('Failed to load roles');
      } finally {
        setLoading(false);
      }
    };

    loadRoles();
  }, [activeTab]);

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Loading roles...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Error</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2 text-gray-900">Roles</h1>
      <p className="text-gray-900 mb-6">Browse available roles and their requirements</p>

      <Tabs defaultValue={activeTab} onValueChange={(value) => setActiveTab(value as 'general' | 'specific')}>
        <TabsList className="mb-6">
          <TabsTrigger value="general">General Roles</TabsTrigger>
          <TabsTrigger value="specific">Specific Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="grid gap-4">
            {roles.map((role) => (
              <Link key={role.id} href={`/roles/${role.id}`}>
                <Card className="p-4 hover:bg-gray-50 cursor-pointer">
                  <h3 className="font-medium text-gray-900">{role.title}</h3>
                  {role.description && (
                    <p className="text-gray-900 mt-2">{role.description}</p>
                  )}
                </Card>
              </Link>
            ))}
            {roles.length === 0 && (
              <p className="text-gray-900">No general roles found.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="specific">
          <div className="grid gap-4">
            {roles.map((role) => (
              <Link key={role.id} href={`/roles/${role.id}`}>
                <Card className="p-4 hover:bg-gray-50 cursor-pointer">
                  <h3 className="font-medium text-gray-900">{role.title}</h3>
                  {role.description && (
                    <p className="text-gray-900 mt-2">{role.description}</p>
                  )}
                </Card>
              </Link>
            ))}
            {roles.length === 0 && (
              <p className="text-gray-900">No specific roles found.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 