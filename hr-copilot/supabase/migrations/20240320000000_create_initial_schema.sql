-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CORE ENTITIES

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  website text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.divisions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES public.companies(id),
  name text NOT NULL,
  cluster text,
  agency text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  division_id uuid REFERENCES public.divisions(id),
  grade_band text,
  location text,
  anzsco_code text,
  pcat_code text,
  date_approved date,
  primary_purpose text,
  reporting_line text,
  direct_reports text,
  budget_responsibility text,
  source_document_url text,
  raw_json jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id uuid REFERENCES public.roles(id),
  title text NOT NULL,
  open_date date,
  close_date date,
  department text,
  job_type text,
  external_id text,
  source_url text,
  remuneration text,
  recruiter jsonb,
  locations text[],
  raw_json jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.capabilities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  group_name text,
  description text,
  source_framework text,
  is_occupation_specific boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.capability_levels (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  capability_id uuid REFERENCES public.capabilities(id),
  level text,
  summary text,
  behavioral_indicators text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  category text,
  description text,
  source text,
  is_occupation_specific boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text,
  email text,
  current_role text,
  division text,
  last_active timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.career_paths (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_role_id uuid REFERENCES public.roles(id),
  target_role_id uuid REFERENCES public.roles(id),
  path_type text,
  recommended_by text,
  supporting_evidence text[],
  popularity_score numeric,
  skill_gap_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name text,
  action_type text,
  target_type text,
  target_id uuid,
  outcome text,
  payload jsonb,
  confidence_score numeric,
  session_id uuid,
  timestamp timestamptz DEFAULT now()
);

-- JOIN TABLES
CREATE TABLE IF NOT EXISTS public.profile_skills (
  profile_id uuid REFERENCES public.profiles(id),
  skill_id uuid REFERENCES public.skills(id),
  rating text,
  evidence text,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (profile_id, skill_id)
);

CREATE TABLE IF NOT EXISTS public.role_skills (
  role_id uuid REFERENCES public.roles(id),
  skill_id uuid REFERENCES public.skills(id),
  PRIMARY KEY (role_id, skill_id)
);

CREATE TABLE IF NOT EXISTS public.job_skills (
  job_id uuid REFERENCES public.jobs(id),
  skill_id uuid REFERENCES public.skills(id),
  PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE IF NOT EXISTS public.profile_capabilities (
  profile_id uuid REFERENCES public.profiles(id),
  capability_id uuid REFERENCES public.capabilities(id),
  level text,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (profile_id, capability_id)
);

CREATE TABLE IF NOT EXISTS public.role_capabilities (
  role_id uuid REFERENCES public.roles(id),
  capability_id uuid REFERENCES public.capabilities(id),
  capability_type text, -- focus or complementary
  level text,
  PRIMARY KEY (role_id, capability_id, capability_type)
);

CREATE TABLE IF NOT EXISTS public.profile_career_paths (
  profile_id uuid REFERENCES public.profiles(id),
  career_path_id uuid REFERENCES public.career_paths(id),
  PRIMARY KEY (profile_id, career_path_id)
);

CREATE TABLE IF NOT EXISTS public.profile_job_interactions (
  profile_id uuid REFERENCES public.profiles(id),
  job_id uuid REFERENCES public.jobs(id),
  interaction_type text,
  timestamp timestamptz DEFAULT now(),
  PRIMARY KEY (profile_id, job_id, interaction_type)
);

CREATE TABLE IF NOT EXISTS public.profile_agent_actions (
  profile_id uuid REFERENCES public.profiles(id),
  action_id uuid REFERENCES public.agent_actions(id),
  PRIMARY KEY (profile_id, action_id)
);

CREATE TABLE IF NOT EXISTS public.role_documents (
  role_id uuid REFERENCES public.roles(id),
  document_id uuid,
  document_url text,
  document_type text,
  title text,
  PRIMARY KEY (role_id, document_id)
);

CREATE TABLE IF NOT EXISTS public.job_documents (
  job_id uuid REFERENCES public.jobs(id),
  document_id uuid,
  document_url text,
  document_type text,
  title text,
  PRIMARY KEY (job_id, document_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capability_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_career_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_job_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_documents ENABLE ROW LEVEL SECURITY;

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all tables
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.divisions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.capabilities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.capability_levels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.skills
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.career_paths
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at(); 