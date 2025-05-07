import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { DatabaseResponse } from '../types';
import { logAgentAction } from '../agent/logAgentAction';

export interface ResumeParseResult {
  inferredRole?: string;
  skills: {
    name: string;
    source: 'resume';
  }[];
  capabilities: {
    name: string;
    source: 'resume';
  }[];
  rawText?: string;
}

const SUPPORTED_FILE_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadResume(
  supabase: SupabaseClient,
  profileId: string,
  file: File
): Promise<DatabaseResponse<ResumeParseResult>> {
  try {
    // Validate file
    if (!file) {
      return {
        data: null,
        error: {
          type: 'INVALID_INPUT',
          message: 'No file provided'
        }
      };
    }

    if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
      return {
        data: null,
        error: {
          type: 'INVALID_INPUT',
          message: 'Unsupported file type. Please upload PDF, DOCX, or TXT files.'
        }
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        data: null,
        error: {
          type: 'INVALID_INPUT',
          message: 'File too large. Maximum size is 10MB.'
        }
      };
    }

    // Upload file to storage
    const timestamp = new Date().getTime();
    const filePath = `resumes/${profileId}/${timestamp}_${file.name}`;
    
    const { error: uploadError } = await supabase
      .storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to upload resume',
          details: uploadError
        }
      };
    }

    // Get file URL for parsing
    const { data: { publicUrl } } = supabase
      .storage
      .from('documents')
      .getPublicUrl(filePath);

    // Parse resume using OpenAI
    const parseResult = await parseResumeWithAI(publicUrl, file.type);
    if (!parseResult.success || !parseResult.data) {
      return {
        data: null,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Failed to parse resume',
          details: parseResult.error
        }
      };
    }

    const { data: parsedData } = parseResult;

    // Store extracted skills
    if (parsedData.skills.length > 0) {
      const { error: skillsError } = await supabase
        .from('profile_skills')
        .insert(
          parsedData.skills.map(skill => ({
            profile_id: profileId,
            name: skill.name,
            source: 'resume'
          }))
        );

      if (skillsError) {
        console.error('Failed to store skills:', skillsError);
      }
    }

    // Store extracted capabilities
    if (parsedData.capabilities.length > 0) {
      const { error: capsError } = await supabase
        .from('profile_capabilities')
        .insert(
          parsedData.capabilities.map(cap => ({
            profile_id: profileId,
            name: cap.name,
            source: 'resume'
          }))
        );

      if (capsError) {
        console.error('Failed to store capabilities:', capsError);
      }
    }

    // Update profile with inferred role if available
    if (parsedData.inferredRole) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ inferred_role: parsedData.inferredRole })
        .eq('id', profileId);

      if (profileError) {
        console.error('Failed to update profile with inferred role:', profileError);
      }
    }

    // Log the action
    await logAgentAction(
      supabase,
      'profile',
      profileId,
      {
        action: 'resume_upload',
        skillsCount: parsedData.skills.length,
        capabilitiesCount: parsedData.capabilities.length,
        hasInferredRole: !!parsedData.inferredRole
      }
    );

    return {
      data: parsedData,
      error: null
    };

  } catch (error) {
    return {
      data: null,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Failed to process resume upload',
        details: error
      }
    };
  }
}

async function parseResumeWithAI(
  fileUrl: string,
  fileType: string
): Promise<{ success: boolean; data?: ResumeParseResult; error?: any }> {
  try {
    // This is a placeholder for the actual AI parsing implementation
    // You would implement this using OpenAI, Claude, or another service
    
    // Example structure of the AI call:
    // 1. Extract text from document using appropriate parser
    // 2. Send to AI with prompt to extract:
    //    - Current or most recent role
    //    - Technical skills
    //    - Soft skills and capabilities
    // 3. Process and categorize the response

    // For now, return mock data
    return {
      success: true,
      data: {
        inferredRole: 'Software Engineer',
        skills: [
          { name: 'TypeScript', source: 'resume' },
          { name: 'React', source: 'resume' }
        ],
        capabilities: [
          { name: 'Project Management', source: 'resume' },
          { name: 'Team Leadership', source: 'resume' }
        ],
        rawText: 'Sample extracted text...'
      }
    };

  } catch (error) {
    return {
      success: false,
      error
    };
  }
} 