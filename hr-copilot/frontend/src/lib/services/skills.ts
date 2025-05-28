import { dataEdge } from '../data-edge';

export interface Skill {
  id: string;
  name: string;
  category: string;
  description: string | null;
  source?: string;
  is_occupation_specific?: boolean;
}

export async function getSkills() {
  return dataEdge({ 
    insightId: 'getSkills'
  });
}

export async function getSkill(id: string) {
  return dataEdge({ 
    insightId: 'getSkill',
    params: { id }
  });
} 