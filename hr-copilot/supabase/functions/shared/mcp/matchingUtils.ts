import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
);

interface Role {
  id: string;
  title: string;
  description: string;
  requirements: string[];
}

interface Profile {
  id: string;
  name: string;
  skills: string[];
  experience: string[];
}

/**
 * Find matching candidates for a given role
 */
export async function findCandidateMatches(roleId: string) {
  try {
    // First get the role data
    const { data: role, error: roleError } = await supabaseClient
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single();

    if (roleError) {
      console.error('Error fetching role:', roleError);
      return [];
    }

    if (!role || !Array.isArray(role.requirements) || role.requirements.length === 0) {
      console.warn('No valid requirements found for role:', roleId);
      return [];
    }

    // Get candidates that match the role requirements
    const { data: matches, error: matchError } = await supabaseClient
      .from('profiles')
      .select('id, name, skills, experience')
      .contains('skills', role.requirements);

    if (matchError) {
      console.error('Error finding candidate matches:', matchError);
      return [];
    }

    return matches || [];
  } catch (error) {
    console.error('Error in findCandidateMatches:', error);
    return [];
  }
}

/**
 * Find matching roles for a given candidate
 */
export async function findRoleMatches(profileId: string) {
  try {
    // First get the profile data
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, name, skills, experience')
      .eq('id', profileId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return [];
    }

    if (!profile || !Array.isArray(profile.skills) || profile.skills.length === 0) {
      console.warn('No valid skills found for profile:', profileId);
      return [];
    }

    // Get roles that match the candidate's skills
    const { data: matches, error: matchError } = await supabaseClient
      .from('roles')
      .select('id, title, description, requirements')
      .filter('requirements', 'cs', `{${profile.skills.join(',')}}`);

    if (matchError) {
      console.error('Error finding role matches:', matchError);
      return [];
    }

    return matches || [];
  } catch (error) {
    console.error('Error in findRoleMatches:', error);
    return [];
  }
}

/**
 * Generate chat response based on context and data
 */
export async function generateChatResponse(context: any, data: any) {
  try {
    const matchCount = Array.isArray(data.matches) ? data.matches.length : 0;
    let message = `I've analyzed the information and found ${matchCount} potential matches.`;
    
    if (matchCount > 0) {
      message += ' Would you like to know more about any specific match?';
    } else {
      message += ' Would you like suggestions on how to improve your matching potential?';
    }

    return {
      message,
      followUpQuestion: matchCount > 0 
        ? 'Which match would you like to learn more about?'
        : 'Would you like some recommendations for improving your matches?'
    };
  } catch (error) {
    console.error('Error generating chat response:', error);
    return {
      message: 'I apologize, but I encountered an error while analyzing the matches.',
      followUpQuestion: 'Would you like to try a different approach?'
    };
  }
}

/**
 * Generate recommendations based on mode and data
 */
export async function generateRecommendations(mode: 'hiring' | 'candidate' | 'general', data: any) {
  const recommendations: string[] = [];

  switch (mode) {
    case 'hiring':
      recommendations.push(
        'Consider candidates with complementary skills',
        'Review candidate experience levels',
        'Check for culture fit indicators'
      );
      break;
    case 'candidate':
      recommendations.push(
        'Update your skills to match market demand',
        'Consider roles that align with your experience',
        'Highlight relevant achievements'
      );
      break;
    case 'general':
      recommendations.push(
        'Explore different career paths',
        'Keep skills up to date',
        'Network within your industry'
      );
      break;
  }

  return recommendations;
}

/**
 * Determine next possible actions based on mode and data
 */
export async function determineNextActions(mode: 'hiring' | 'candidate' | 'general', data: any) {
  const actions: string[] = [];

  switch (mode) {
    case 'hiring':
      actions.push(
        'Review candidate profiles',
        'Schedule interviews',
        'Compare candidate qualifications'
      );
      break;
    case 'candidate':
      actions.push(
        'Apply to matching roles',
        'Update profile information',
        'Request role recommendations'
      );
      break;
    case 'general':
      actions.push(
        'Start job search',
        'Create hiring plan',
        'Get market insights'
      );
      break;
  }

  return actions;
} 