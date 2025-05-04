'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import UnifiedResultsView from '../components/UnifiedResultsView';
import ProfileFinder from '../components/ProfileFinder';

interface Profile {
  id: string;
  name: string;
  currentRole: string;
  department: string;
  pageUpId?: string;
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = searchParams.get('context') as 'profile' | 'role' | 'open';
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const handleProfileSelect = (profile: Profile) => {
    setSelectedProfile(profile);
  };

  // If no context is provided, redirect to home
  if (!context) {
    router.push('/');
    return null;
  }

  // Show profile finder when context is profile and no profile is selected
  if (context === 'profile' && !selectedProfile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">Find Your Profile</h1>
            <p className="text-base text-gray-600">
              Search for your profile to start the conversation
            </p>
          </div>
          <ProfileFinder onProfileSelect={handleProfileSelect} />
        </div>
      </div>
    );
  }

  // Show chat interface with profile data when profile is selected
  if (selectedProfile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <UnifiedResultsView
            profileData={{
              name: selectedProfile.name,
              currentRole: selectedProfile.currentRole,
              department: selectedProfile.department,
              tenure: "N/A",
              skills: []
            }}
            startContext="profile"
          />
        </div>
      </div>
    );
  }

  // Default view for other contexts (role or open)
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <UnifiedResultsView
          startContext={context}
        />
      </div>
    </div>
  );
} 