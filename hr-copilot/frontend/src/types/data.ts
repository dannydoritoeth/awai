export interface RoleData {
  id: string;
  title: string;
  company: string;
  department?: string;
  location?: string;
  description?: string;
  skills?: string[];
  requirements?: string[];
}

export interface ProfileData {
  id?: string;
  name?: string;
  currentRole?: string;
  department?: string;
  tenure?: string;
  skills?: Array<{ name: string; level?: number | null }>;
  roles?: Array<{
    title: string;
    company: string;
    years: number;
  }>;
  preferences?: {
    desiredRoles: string[];
  };
  additionalContext?: string;
  profile?: {
    name: string;
    id: string;
  };
} 