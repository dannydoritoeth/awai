'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import UnifiedResultsView from '../components/UnifiedResultsView';
import ProfileFinder from '../components/ProfileFinder';
import RoleFinder from '../components/RoleFinder';
import { startSession } from '@/lib/api/chat';
import { getBrowserSessionId } from '@/lib/browserSession';
import { events, EVENT_NAMES } from '@/lib/events';

interface Profile {
  id: string;
  name: string;
  currentRole: string;
  department: string;
  skills: string[];
}

interface Role {
  id: string;
  title: string;
  department: string;
  location: string;
  description: string;
  requirements: string[];
  skills: string[];
}

// Separate component that uses useSearchParams
function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = searchParams.get('context') as 'profile' | 'role' | 'open';
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const handleProfileSelect = async (profile: Profile) => {
    setSelectedProfile(profile);
    await createSession('profile', profile.id);
  };

  const handleRoleSelect = async (role: Role) => {
    setSelectedRole(role);
    await createSession('role', role.id);
  };

  const createSession = async (type: 'profile' | 'role', entityId: string) => {
    setIsCreatingSession(true);
    
    try {
      const initialMessage = type === 'profile' 
        ? `I'm interested in finding roles that match this profile`
        : `I'm looking for candidates who would be a good fit for this role`;

      const browserSessionId = getBrowserSessionId();
      
      const result = await startSession({
        action: 'startSession',
        message: initialMessage,
        browserSessionId,
        ...(type === 'profile' ? { profileId: entityId } : { roleId: entityId })
      });
      
      events.emit(EVENT_NAMES.SESSION_CREATED);
      setSessionId(result.sessionId);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsCreatingSession(false);
    }
  };

  // If no context is provided, redirect to home
  if (!context) {
    router.push('/');
    return null;
  }

  // Show profile search when context is profile and no profile is selected
  if (context === 'profile' && !selectedProfile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">Search for Profile</h1>
            <p className="text-base text-gray-600">
              Find a profile to start the conversation
            </p>
          </div>
          <ProfileFinder onProfileSelect={handleProfileSelect} />
        </div>
      </div>
    );
  }

  // Show role search when context is role and no role is selected
  if (context === 'role' && !selectedRole) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">Search for Role</h1>
            <p className="text-base text-gray-600">
              Find a role to start the conversation
            </p>
          </div>
          <RoleFinder onRoleSelect={handleRoleSelect} />
        </div>
      </div>
    );
  }

  // Loading state while creating session
  if (isCreatingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Setting up your conversation...</p>
        </div>
      </div>
    );
  }

  // Show chat interface with profile data when profile is selected
  if (selectedProfile && sessionId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <UnifiedResultsView
            profileData={{
              id: selectedProfile.id,
              name: selectedProfile.name,
              currentRole: selectedProfile.currentRole,
              department: selectedProfile.department,
              tenure: "N/A",
              skills: selectedProfile.skills
            }}
            startContext="profile"
            sessionId={sessionId}
          />
        </div>
      </div>
    );
  }

  // Show chat interface with role data when role is selected
  if (selectedRole && sessionId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <UnifiedResultsView
            roleData={{
              id: selectedRole.id,
              title: selectedRole.title,
              department: selectedRole.department,
              location: selectedRole.location,
              description: selectedRole.description,
              requirements: selectedRole.requirements,
              skills: selectedRole.skills
            }}
            startContext="role"
            sessionId={sessionId}
          />
        </div>
      </div>
    );
  }

  // Default view for open context
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

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

// Main component with Suspense boundary
export default function ChatPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ChatPageContent />
    </Suspense>
  );
} 