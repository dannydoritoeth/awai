import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import type { Division } from '@/lib/services/divisions';

interface DivisionInfoPanelProps {
  division: Division;
}

export default function DivisionInfoPanel({ division }: DivisionInfoPanelProps) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="space-y-4">
            {division.cluster && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Cluster</h3>
                <p className="mt-1 text-gray-900">{division.cluster}</p>
              </div>
            )}
            {division.agency && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Agency</h3>
                <p className="mt-1 text-gray-900">{division.agency}</p>
              </div>
            )}
            {division.company && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Company</h3>
                <Link 
                  href={`/companies/${division.company.id}`}
                  className="mt-1 text-blue-600 hover:underline block"
                >
                  {division.company.name}
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Division Details */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Details</h2>
          <div className="space-y-4">
            {/* Add more details as they become available */}
            <div>
              <h3 className="text-sm font-medium text-gray-500">Created</h3>
              <p className="mt-1 text-gray-900">
                {new Date(division.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 