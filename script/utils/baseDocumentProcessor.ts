import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local first, then fallback to .env
const envLocalPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');

dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath }); // Fallback to .env if variables not found in .env.local

export abstract class BaseDocumentProcessor {
  protected openai: OpenAI;

  constructor() {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OpenAI API key is required. Please ensure OPENAI_API_KEY is set in your .env.local file.');
    }
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  /**
   * Extract text content from a document
   */
  abstract extractContent(content: string): Promise<string | null>;

  /**
   * Normalize grade band format
   */
  protected normalizeGradeBand(gradeBand: string): string {
    // Convert variations like "Clerk 7-8", "Clerk Grade 7/8" to "Clerk Grade 7-8"
    return gradeBand
      .replace(/Clerk\s+(?!Grade)(\d+[-\/]\d+)/, 'Clerk Grade $1')
      .replace('/', '-');
  }

  /**
   * Extract structured data using AI
   */
  protected async extractDataWithAI(content: string): Promise<any> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [{
          role: "system",
          content: `Extract structured data from the job description. Return a JSON object with:
            - title: Role name
            - roleId: Job ID if available
            - gradeBand: Pay level/classification (e.g. "Clerk Grade 7-8" - look for this exact format or variations like "Clerk 7-8" or "Clerk Grade 7/8")
            - division: Organizational unit
            - cluster: Higher-level grouping
            - agency: Responsible agency
            - location: Office location/work arrangement
            - primaryPurpose: One-paragraph summary
            - keyAccountabilities: Array of main duties
            - keyChallenges: Array of role challenges
            - essentialRequirements: Array of mandatory qualifications
            - focusCapabilities: Array of core capabilities
            - skills: Array of required technical and soft skills (focus on key technical skills, software proficiencies, and core competencies mentioned in the job description)

            For the gradeBand field, focus on finding the Clerk Grade classification (e.g. "Clerk Grade 7-8") rather than employment type or contract duration.
            
            For the skills field, extract specific technical skills, software proficiencies, and core competencies. Look for these in:
            - Essential requirements
            - Key accountabilities
            - Focus capabilities
            - Technical skills sections
            
            Format skills consistently:
            - Use lowercase
            - Remove punctuation
            - Use general terms (e.g. "user experience design" instead of "ux design")
            - Include both technical (e.g. "software configuration", "requirements analysis") and soft skills (e.g. "stakeholder management", "communication")`
        }, {
          role: "user",
          content: content
        }],
        response_format: { type: "json_object" }
      });

      const responseContent = completion.choices[0].message.content;
      if (!responseContent) return null;

      const data = JSON.parse(responseContent);
      
      // Normalize grade band format
      if (data.gradeBand) {
        data.gradeBand = this.normalizeGradeBand(data.gradeBand);
      }

      return data;
    } catch (error) {
      console.error('Error extracting structured data:', error);
      return null;
    }
  }
} 