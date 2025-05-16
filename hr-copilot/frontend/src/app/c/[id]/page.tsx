'use client';

import { use, useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import UnifiedResultsView from '@/app/components/UnifiedResultsView';
import { supabase } from '@/lib/supabase';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface RoleData {
  id: string;
  title: string;
  company: string;
  department?: string;
  location?: string;
  description?: string;
  skills?: string[];
  requirements?: string[];
}

interface ProfileData {
  id: string;
  name: string;
  currentRole?: string;
  department?: string;
  tenure?: string;
  skills?: Array<{ name: string; level?: number | null }>;
}

interface DatabaseRole {
  id: string;
  title: string;
  division: {
    name: string | null;
  } | null;
  location: string | null;
  primary_purpose: string | null;
  role_skills: Array<{
    skill: {
      name: string;
    };
  }>;
}

interface DatabaseProfile {
  id: string;
  name: string;
  role_title: string | null;
  division: string | null;
  profile_skills: Array<{
    skill: {
      name: string;
    };
  }>;
}

// Component that uses useSearchParams
function ChatPageContent({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const context = searchParams.get('context') as 'profile' | 'role' | 'open';
  const [roleData, setRoleData] = useState<RoleData | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  console.log('ChatPageContent rendered:', {
    sessionId,
    context,
    pathname
  });

  useEffect(() => {
    if (!context) {
      console.log('No context found, redirecting to home');
      router.push('/');
    }
  }, [context, router]);

  useEffect(() => {
    async function loadSessionData() {
      if (!sessionId || !supabase) {
        console.log('Early return - missing sessionId or supabase client:', { 
          sessionId, 
          hasSupabase: !!supabase 
        });
        return;
      }

      console.log('Loading session data for:', sessionId);

      try {
        // Get the conversation session data
        const { data: sessionData, error: sessionError } = await supabase
          .from('conversation_sessions')
          .select('id, mode, entity_id')
          .eq('id', sessionId)
          .single();

        console.log('Session query result:', {
          hasData: !!sessionData,
          error: sessionError?.message,
          mode: sessionData?.mode,
          entityId: sessionData?.entity_id
        });

        if (sessionError) {
          console.error('Failed to load session:', sessionError);
          return;
        }

        if (!sessionData?.entity_id) {
          console.log('No entity_id found in session');
          return;
        }

        // Load role data if this is a hiring session
        if (sessionData.mode === 'hiring') {
          console.log('Loading role data for ID:', sessionData.entity_id);
          const { data: roleData, error: roleError } = await supabase
            .from('roles')
            .select(`
              id,
              title,
              division:divisions(name),
              location,
              primary_purpose,
              role_skills (
                skill:skills (
                  name
                )
              )
            `)
            .eq('id', sessionData.entity_id)
            .single();

          console.log('Role data query result:', {
            hasData: !!roleData,
            error: roleError?.message,
            roleId: roleData?.id,
            skillsCount: roleData?.role_skills?.length
          });

          if (roleError) {
            console.error('Failed to load role:', roleError);
            return;
          }

          if (roleData) {
            const typedRoleData = roleData as unknown as DatabaseRole;
            setRoleData({
              id: typedRoleData.id,
              title: typedRoleData.title,
              company: typedRoleData.division?.name || '',
              department: typedRoleData.division?.name || '',
              location: typedRoleData.location || '',
              description: typedRoleData.primary_purpose || '',
              requirements: [], // Could be loaded from another table if needed
              skills: typedRoleData.role_skills.map(rs => rs.skill.name)
            });
          }
        }

        // Load profile data if this is a candidate session
        if (sessionData.mode === 'candidate') {
          console.log('Loading profile data for ID:', sessionData.entity_id);
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select(`
              id,
              name,
              role_title,
              division,
              profile_skills (
                skill:skills (
                  name
                )
              )
            `)
            .eq('id', sessionData.entity_id)
            .single();

          console.log('Profile data query result:', {
            hasData: !!profileData,
            error: profileError?.message,
            profileId: profileData?.id,
            skillsCount: profileData?.profile_skills?.length
          });

          if (profileError) {
            console.error('Failed to load profile:', profileError);
            return;
          }

          if (profileData) {
            const typedProfileData = profileData as unknown as DatabaseProfile;
            setProfileData({
              id: typedProfileData.id,
              name: typedProfileData.name,
              currentRole: typedProfileData.role_title || '',
              department: typedProfileData.division || '',
              skills: typedProfileData.profile_skills.map(ps => ({ 
                name: ps.skill.name 
              }))
            });
          }
        }

      } catch (error) {
        const err = error as Error;
        console.error('Error loading session data:', {
          name: err.name,
          message: err.message,
          stack: err.stack
        });
      }
    }

    loadSessionData();
  }, [sessionId]);

  // If no context is provided, show nothing while redirecting
  if (!context) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-[1200px]">
        <UnifiedResultsView
          startContext={context}
          sessionId={sessionId}
          roleData={roleData || undefined}
          profileData={profileData || undefined}
        />
      </div>
    </div>
  );
}

// Main component with Suspense boundary
export default function ChatPage({ params }: PageProps) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPageContent sessionId={resolvedParams.id} />
    </Suspense>
  );
} 