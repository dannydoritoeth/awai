import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import type { Company } from '@/lib/services/companies';

interface CompanyInfoPanelProps {
  company: Company;
}

export default function CompanyInfoPanel({ company }: CompanyInfoPanelProps) {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Overview</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Divisions</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {company.divisions?.length || 0}
              </p>
            </div>
            {company.institution && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Institution</h3>
                <Link 
                  href={`/institutions/${company.institution.id}`}
                  className="mt-1 text-blue-600 hover:underline block"
                >
                  {company.institution.name}
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Company Details */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Details</h2>
          <div className="space-y-4">
            {company.description && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Description</h3>
                <p className="mt-1 text-gray-900">{company.description}</p>
              </div>
            )}
            {company.website_url && (
              <div>
                <h3 className="text-sm font-medium text-gray-500">Website</h3>
                <a 
                  href={company.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-blue-600 hover:underline"
                >
                  {company.website_url}
                </a>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-500">Created</h3>
              <p className="mt-1 text-gray-900">
                {new Date(company.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 