import { dataEdge } from '../data-edge';

export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string | null;
  source?: string;
  is_occupation_specific?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SkillResponse {
  success: boolean;
  data: Skill | Skill[] | null;
  error: string | null;
}

export async function getSkills(): Promise<Skill[]> {
  const response = await dataEdge({ 
    insightId: 'getSkills'
  }) as SkillResponse;

  if (!response.success || !response.data) {
    console.error('Error fetching skills:', response.error);
    return [];
  }

  return response.data as Skill[];
}

export async function getSkill(id: string): Promise<Skill | null> {
  const response = await dataEdge({ 
    insightId: 'getSkill',
    params: { id }
  }) as SkillResponse;

  if (!response.success || !response.data) {
    console.error('Error fetching skill:', response.error);
    return null;
  }

  return response.data as Skill;
} 