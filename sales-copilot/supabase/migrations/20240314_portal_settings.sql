-- Create portal_settings table
create table if not exists portal_settings (
  id uuid default uuid_generate_v4() primary key,
  portal_id text not null unique,
  settings jsonb default '{}'::jsonb,
  setup_completed boolean default false,
  setup_completed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Add RLS policies
alter table portal_settings enable row level security;

create policy "Allow public read of portal settings"
  on portal_settings for select
  using (true);

create policy "Allow authenticated insert to portal settings"
  on portal_settings for insert
  with check (auth.role() = 'authenticated');

create policy "Allow authenticated update to portal settings"
  on portal_settings for update
  using (auth.role() = 'authenticated');

-- Add indexes
create index if not exists portal_settings_portal_id_idx on portal_settings(portal_id);

-- Add trigger for updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_portal_settings_updated_at
  before update on portal_settings
  for each row
  execute function update_updated_at_column(); 