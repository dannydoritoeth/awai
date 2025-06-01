import { Card, CardContent } from '@/components/ui/card';
import type { InstitutionDetail } from '@/lib/services/institutions';

interface InstitutionInfoPanelProps {
  institution: InstitutionDetail;
}

export default function InstitutionInfoPanel({ institution }: InstitutionInfoPanelProps) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Companies</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900">{institution.companies.length}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Divisions</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {institution.companies.reduce((acc, company) => acc + (company.divisions?.length || 0), 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Institution Details */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Details</h2>
          <div className="space-y-4">
            {institution.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Description</h3>
                <p className="mt-1 text-gray-900">{institution.description}</p>
              </div>
            )}
            {/* Add more details as they become available */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 