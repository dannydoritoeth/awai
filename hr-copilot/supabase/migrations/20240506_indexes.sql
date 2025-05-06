-- Indexes for profile-related queries
create index if not exists idx_profile_skills_profile_skill 
on profile_skills(profile_id, skill_id);

create index if not exists idx_profile_skills_rating 
on profile_skills(rating);

create index if not exists idx_profile_capabilities_level 
on profile_capabilities(level);

-- Indexes for role-related queries
create index if not exists idx_role_skills_role_skill 
on role_skills(role_id, skill_id);

create index if not exists idx_role_capabilities_level 
on role_capabilities(level);

create index if not exists idx_role_capabilities_type 
on role_capabilities(capability_type);

-- Indexes for job interactions
create index if not exists idx_profile_job_interactions_profile_timestamp 
on profile_job_interactions(profile_id, timestamp desc);

create index if not exists idx_profile_job_interactions_type_timestamp 
on profile_job_interactions(interaction_type, timestamp desc);

-- Indexes for career paths
create index if not exists idx_career_paths_target_role 
on career_paths(target_role_id);

create index if not exists idx_career_paths_popularity 
on career_paths(popularity_score desc);

-- Indexes for capabilities and skills
create index if not exists idx_capabilities_group 
on capabilities(group_name);

create index if not exists idx_skills_category 
on skills(category);

-- Add comments explaining the purpose of these indexes
comment on index idx_profile_skills_profile_skill is 'Improves performance of profile skill lookups and joins';
comment on index idx_profile_skills_rating is 'Improves performance of skill level filtering';
comment on index idx_profile_capabilities_level is 'Improves performance of capability level filtering';
comment on index idx_role_skills_role_skill is 'Improves performance of role skill lookups and joins';
comment on index idx_role_capabilities_level is 'Improves performance of capability level matching';
comment on index idx_role_capabilities_type is 'Improves performance of capability type filtering';
comment on index idx_profile_job_interactions_profile_timestamp is 'Improves performance of recent job interaction queries';
comment on index idx_profile_job_interactions_type_timestamp is 'Improves performance of interaction type filtering';
comment on index idx_career_paths_target_role is 'Improves performance of career path destination queries';
comment on index idx_career_paths_popularity is 'Improves performance of popular career path queries';
comment on index idx_capabilities_group is 'Improves performance of capability group filtering';
comment on index idx_skills_category is 'Improves performance of skill category filtering';