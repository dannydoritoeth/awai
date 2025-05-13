'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Profile {
  id: string;
  name: string;
  currentRole: string;
  department: string;
  skills: string[];
}

// Define the shape of data returned from Supabase
interface SupabaseProfile {
  id: string;
  name: string | null;
  role_title: string | null;
  division: string | null;
  skills: {
    skill: {
      name: string;
    }
  }[] | null;
}

interface ProfileFinderProps {
  onProfileSelect: (profile: Profile) => void;
}

export default function ProfileFinder({ onProfileSelect }: ProfileFinderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    setIsLoading(true);
    
    try {
      let query = supabase
        .from('profiles')
        .select('id, name, role_title, division, skills:profile_skills(skill:skills(name))')
        .order('name', { ascending: true })
        .limit(10);
      
      // Apply search filter if query is provided
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,role_title.ilike.%${searchQuery}%,division.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Transform the data to match our Profile interface
      const profiles: Profile[] = [];
      
      if (data) {
        for (const profile of data as unknown as SupabaseProfile[]) {
          // Extract skills from the joins
          const skillList: string[] = [];
          
          if (profile.skills && Array.isArray(profile.skills)) {
            for (const skillObj of profile.skills) {
              if (skillObj.skill && skillObj.skill.name) {
                skillList.push(skillObj.skill.name);
              }
            }
          }
          
          profiles.push({
            id: profile.id,
            name: profile.name || 'Unnamed Profile',
            currentRole: profile.role_title || 'No Role',
            department: profile.division || 'No Division',
            skills: skillList
          });
        }
      }
      
      setSearchResults(profiles);
    } catch (error) {
      console.error('Error searching profiles:', error);
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
              placeholder="Search by name, role, or department..."
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
          Search Profiles
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
              No profiles found matching your search.
            </div>
          ) : (
            searchResults.map((profile) => (
              <button
                key={profile.id}
                onClick={() => onProfileSelect(profile)}
                className="w-full p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{profile.name}</h3>
                    <p className="text-sm text-gray-600">{profile.currentRole}</p>
                    <p className="text-xs text-gray-500">{profile.department}</p>
                    
                    {profile.skills && profile.skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {profile.skills.slice(0, 3).map((skill, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                        {profile.skills.length > 3 && (
                          <span className="px-2 py-0.5 text-gray-500 text-xs">
                            +{profile.skills.length - 3} more
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