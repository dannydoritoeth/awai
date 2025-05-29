import { Card, CardContent } from '@/components/ui/card';
import type { Taxonomy } from '@/lib/services/data';

interface TaxonomyInfoPanelProps {
  taxonomy: Taxonomy;
}

export default function TaxonomyInfoPanel({ taxonomy }: TaxonomyInfoPanelProps) {
  return (
    <Card className="w-80 h-fit">
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* About Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">About</h2>
            <p className="text-gray-700">
              {taxonomy.description || 'No description available.'}
            </p>
          </div>

          {/* Stats Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Statistics</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Total Roles</p>
                <p className="text-2xl font-semibold text-blue-600">{taxonomy.role_count || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Divisions</p>
                <p className="text-2xl font-semibold text-blue-600">{taxonomy.divisions?.length || 0}</p>
              </div>
            </div>
          </div>

          {/* Metadata Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Details</h2>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="text-gray-900">{taxonomy.taxonomy_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-gray-900">{new Date(taxonomy.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-gray-900">{new Date(taxonomy.updated_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 