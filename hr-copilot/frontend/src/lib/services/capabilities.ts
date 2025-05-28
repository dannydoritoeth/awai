import { dataEdge } from '../data-edge';

export interface Capability {
  id: string;
  name: string;
  group_name: string;
  description: string | null;
  type: string;
  level: string;
}

export async function getCapabilities() {
  return dataEdge({ 
    insightId: 'getCapabilities'
  });
}

export async function getCapability(id: string) {
  return dataEdge({ 
    insightId: 'getCapability',
    params: { id }
  });
} 