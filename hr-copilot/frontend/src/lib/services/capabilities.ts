import { dataEdge } from '../data-edge';

export interface Capability {
  id: string;
  name: string;
  group_name: string;
  description: string | null;
  type: string;
  level: string;
  roles?: {
    id: string;
    title: string;
    required_level: string;
  }[];
}

export async function getCapabilities() {
  return dataEdge({ 
    insightId: 'getCapabilities'
  });
}

export async function getCapability(id: string) {
  const response = await dataEdge({ 
    insightId: 'getCapability',
    params: { id }
  });

  if (!response) {
    throw new Error('Failed to fetch capability');
  }

  return response as Capability;
} 