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

-- Enable RLS on both tables
alter table listings enable row level security;
alter table generated_descriptions enable row level security;

-- Drop ALL existing policies first
drop policy if exists "only allow owner" on listings;
drop policy if exists "anyone can view listings" on listings;
drop policy if exists "owners can view their listings" on listings;
drop policy if exists "owners can update their listings" on listings;
drop policy if exists "owners can delete their listings" on listings;
drop policy if exists "owners can create listings" on listings;

drop policy if exists "only allow owner" on generated_descriptions;
drop policy if exists "anyone can view descriptions" on generated_descriptions;
drop policy if exists "owners can view their descriptions" on generated_descriptions;
drop policy if exists "owners can update their descriptions" on generated_descriptions;
drop policy if exists "owners can create descriptions" on generated_descriptions;

-- Then create fresh policies
-- Listings policies
create policy "owners can create listings"
  on listings for insert
  with check (auth.uid() = user_id);

create policy "owners can view their listings"
  on listings for select
  using (auth.uid() = user_id);

create policy "owners can update their listings"
  on listings for update
  using (auth.uid() = user_id);

create policy "owners can delete their listings"
  on listings for delete
  using (auth.uid() = user_id);

-- Generated descriptions policies
create policy "owners can create descriptions"
  on generated_descriptions for insert
  with check (
    exists (
      select 1 from listings
      where listings.id = listing_id
      and listings.user_id = auth.uid()
    )
  );

create policy "owners can view their descriptions"
  on generated_descriptions for select
  using (
    exists (
      select 1 from listings
      where listings.id = generated_descriptions.listing_id
      and listings.user_id = auth.uid()
    )
  );

-- Add status field to the descriptions table
alter table generated_descriptions add column if not exists status text 
  check (status in ('processing', 'completed', 'failed')) 
  default 'completed';
  