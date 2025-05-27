'use client';

import { useState, useEffect } from 'react';
import { getGeneralRoles, getFunctionAreas, getClassificationLevels } from '@/lib/services/data';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';

interface GeneralRole {
  id: string;
  title: string;
  description: string | null;
  function_area: string;
  classification_level: string;
}

export default function GeneralRolesPage() {
  const [roles, setRoles] = useState<GeneralRole[]>([]);
  const [functionAreas, setFunctionAreas] = useState<string[]>([]);
  const [classificationLevels, setClassificationLevels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFunctionArea, setSelectedFunctionArea] = useState<string>('');
  const [selectedClassLevel, setSelectedClassLevel] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [areas, levels] = await Promise.all([
          getFunctionAreas(),
          getClassificationLevels()
        ]);
        setFunctionAreas(areas);
        setClassificationLevels(levels);
      } catch (error) {
        setError('Failed to load filter options');
      }
    };
    loadFilters();
  }, []);

  useEffect(() => {
    const loadRoles = async () => {
      setLoading(true);
      try {
        const response = await getGeneralRoles({
          searchTerm: searchTerm || undefined,
          functionArea: selectedFunctionArea || undefined,
          classificationLevel: selectedClassLevel || undefined,
          limit: itemsPerPage,
          offset: (currentPage - 1) * itemsPerPage
        });

        if (response.success && response.data) {
          setRoles(response.data);
          // In a real implementation, you'd get the total count from the backend
          setTotalPages(Math.ceil(response.data.length / itemsPerPage));
        } else {
          setError(response.error || 'Failed to load roles');
        }
      } catch (error) {
        setError('Failed to load roles');
      } finally {
        setLoading(false);
      }
    };

    loadRoles();
  }, [searchTerm, selectedFunctionArea, selectedClassLevel, currentPage]);

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">General Roles</h1>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Input
          placeholder="Search roles..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
        <Select value={selectedFunctionArea} onValueChange={setSelectedFunctionArea}>
          <SelectTrigger>
            <SelectValue placeholder="Select Function Area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Function Areas</SelectItem>
            {functionAreas.map((area) => (
              <SelectItem key={area} value={area}>{area}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedClassLevel} onValueChange={setSelectedClassLevel}>
          <SelectTrigger>
            <SelectValue placeholder="Select Classification Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Classification Levels</SelectItem>
            {classificationLevels.map((level) => (
              <SelectItem key={level} value={level}>{level}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Roles Grid */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-2">{role.title}</h3>
                <p className="text-gray-600 mb-4">{role.description}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                    {role.function_area}
                  </span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
                    {role.classification_level}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="mt-8 flex justify-center">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
} 