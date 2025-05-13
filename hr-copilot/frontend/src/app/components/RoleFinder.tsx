'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Role {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
  requirements: string[];
  skills: string[];
}

// Define the shape of data returned from Supabase
interface SupabaseRole {
  id: string;
  title: string | null;
  division_id: string | null;
  location: string | null;
  primary_purpose: string | null;
  divisions: {
    name: string;
  } | null;
  skills: {
    skill: {
      name: string;
    }
  }[] | null;
}

interface RoleFinderProps {
  onRoleSelect: (role: Role) => void;
}

export default function RoleFinder({ onRoleSelect }: RoleFinderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Role[]>([]);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    setIsLoading(true);
    
    try {
      let query = supabase
        .from('roles')
        .select('id, title, division_id, location, primary_purpose, divisions(name), skills:role_skills(skill:skills(name))')
        .order('title', { ascending: true })
        .limit(10);
      
      // Apply search filter if query is provided
      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,primary_purpose.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Transform the data to match our Role interface
      const roles: Role[] = [];
      
      if (data) {
        for (const role of data as unknown as SupabaseRole[]) {
          // Extract skills from the joins
          const skillList: string[] = [];
          
          if (role.skills && Array.isArray(role.skills)) {
            for (const skillObj of role.skills) {
              if (skillObj.skill && skillObj.skill.name) {
                skillList.push(skillObj.skill.name);
              }
            }
          }
          
          // Split the primary purpose into requirements (simple approach)
          const primaryPurpose = role.primary_purpose || '';
          const requirements = primaryPurpose
            .split('.')
            .filter(sentence => sentence.trim().length > 0)
            .slice(0, 3); // Just take first 3 sentences as requirements
          
          // Get division name
          let departmentName = 'No Division';
          if (role.divisions && typeof role.divisions === 'object' && role.divisions.name) {
            departmentName = role.divisions.name;
          }
          
          roles.push({
            id: role.id,
            title: role.title || 'Unnamed Role',
            department: departmentName,
            location: role.location || 'No Location',
            description: role.primary_purpose || 'No description available',
            requirements,
            skills: skillList
          });
        }
      }
      
      setSearchResults(roles);
    } catch (error) {
      console.error('Error searching roles:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  // Perform initial search on component mount
  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, department, or skills..."
              className="w-full rounded-lg border-none focus:ring-0 bg-gray-50 text-gray-900 placeholder:text-gray-500 text-sm py-3 px-10"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Search Roles
        </button>
      </form>

      {/* Search Results */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-2">
          {searchResults.length === 0 && searchQuery && !isLoading ? (
            <div className="text-center py-8 text-gray-500">
              No roles found matching your search.
            </div>
          ) : (
            searchResults.map((role) => (
              <button
                key={role.id}
                onClick={() => onRoleSelect(role)}
                className="w-full p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{role.title}</h3>
                    <p className="text-sm text-gray-600">{role.department}</p>
                    <p className="text-xs text-gray-500">{role.location}</p>
                    
                    {role.skills && role.skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {role.skills.slice(0, 3).map((skill, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                        {role.skills.length > 3 && (
                          <span className="px-2 py-0.5 text-gray-500 text-xs">
                            +{role.skills.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
} 