'use client';

import { useState, useEffect } from 'react';
import { getCapabilities } from '@/lib/services/capabilities';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import type { Capability } from '@/lib/services/capabilities';

export default function CapabilitiesPage() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCapabilities = async () => {
      try {
        setLoading(true);
        const data = await getCapabilities();
        setCapabilities(data || []);
      } catch (err) {
        console.error('Error loading capabilities:', err);
        setError('Failed to load capabilities');
      } finally {
        setLoading(false);
      }
    };

    loadCapabilities();
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Capabilities</h1>
        <p className="text-gray-700">Loading capabilities...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Capabilities</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!capabilities?.length) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Capabilities</h1>
        <p className="text-gray-900">No capabilities found.</p>
      </div>
    );
  }

  // Group capabilities by group_name
  const groupedCapabilities = capabilities.reduce((acc: Record<string, Capability[]>, capability: Capability) => {
    const group = capability.group_name || 'Other';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(capability);
    return acc;
  }, {});

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">Capabilities</h1>
      
      {Object.entries(groupedCapabilities).map(([group, capabilities]) => (
        <div key={group} className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">{group}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {capabilities.map((capability) => (
              <Link key={capability.id} href={`/capabilities/${capability.id}`}>
                <Card className="p-4 hover:bg-gray-50 cursor-pointer">
                  <h3 className="font-medium text-gray-900">{capability.name}</h3>
                  {capability.description && (
                    <p className="text-gray-700 mt-2 text-sm">{capability.description}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                      {capability.type}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                      {capability.level}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
} 