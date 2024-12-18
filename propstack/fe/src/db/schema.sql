-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Listings table
create table if not exists listings (
  -- Primary key and timestamps
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- User reference (if using auth)
  user_id uuid references auth.users(id),
  
  -- Basic property info
  address text not null,
  unit_number text,
  listing_type text not null,
  property_type text not null,
  
  -- Property details
  price text,
  bedrooms text,
  bathrooms text,
  parking text,
  lot_size text,
  lot_size_unit text,
  interior_size text,
  
  -- Features and description
  highlights text[],
  other_details text,
  description text,
  
  -- Generation settings
  language text,
  generated_at timestamp with time zone
);

-- Update timestamp trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_listings_updated_at
  before update on listings
  for each row
  execute function update_updated_at_column();

-- Indexes
create index if not exists listings_user_id_idx on listings(user_id);
create index if not exists listings_created_at_idx on listings(created_at desc);

-- RLS Policies (if using auth)
alter table listings enable row level security;

create policy "Users can view their own listings"
  on listings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own listings"
  on listings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own listings"
  on listings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own listings"
  on listings for delete
  using (auth.uid() = user_id);

-- Types (optional, for better data validation)
create type listing_type as enum ('sale', 'rent');
create type property_type as enum (
  'house',
  'condo',
  'vacant-land',
  'multi-family',
  'townhouse',
  'other'
);

-- Comments for documentation
comment on table listings is 'Property listings with AI-generated descriptions';
comment on column listings.highlights is 'Array of nearby features and property highlights';
comment on column listings.generated_at is 'When the AI description was last generated'; 

-- Generated descriptions table
create table if not exists generated_descriptions (
  -- Primary key and timestamps
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- References
  listing_id uuid references listings(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  
  -- Content
  content text not null,
  language text not null,
  word_count integer,
  
  -- Generation settings
  target_length integer,
  target_unit text check (target_unit in ('words', 'characters')),
  
  -- Metadata
  version integer not null,
  is_selected boolean default false,
  prompt_used text,
  model_used text
);

-- Indexes for generated_descriptions
create index if not exists generated_descriptions_listing_id_idx on generated_descriptions(listing_id);
create index if not exists generated_descriptions_user_id_idx on generated_descriptions(user_id);
create index if not exists generated_descriptions_created_at_idx on generated_descriptions(created_at desc);

-- RLS Policies for generated_descriptions
alter table generated_descriptions enable row level security;

create policy "Users can view their own generated descriptions"
  on generated_descriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own generated descriptions"
  on generated_descriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own generated descriptions"
  on generated_descriptions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own generated descriptions"
  on generated_descriptions for delete
  using (auth.uid() = user_id);

-- Function to ensure only one selected description per listing
create or replace function ensure_single_selected_description()
returns trigger as $$
begin
  if new.is_selected then
    update generated_descriptions
    set is_selected = false
    where listing_id = new.listing_id
    and id != new.id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger ensure_single_selected_description_trigger
  before insert or update on generated_descriptions
  for each row
  execute function ensure_single_selected_description();

-- Comments for documentation
comment on table generated_descriptions is 'AI-generated property descriptions with version history';
comment on column generated_descriptions.version is 'Incremental version number for each listing';
comment on column generated_descriptions.is_selected is 'Whether this is the currently selected version';
comment on column generated_descriptions.prompt_used is 'The prompt template used for generation';
comment on column generated_descriptions.model_used is 'The AI model used for generation'; 