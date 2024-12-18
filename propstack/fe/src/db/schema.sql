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

-- Simple ownership policy for listings
create policy "only allow owner"
  on listings
  for all
  using (auth.uid() = user_id);

-- Simple ownership policy for generated descriptions
create policy "only allow owner"
  on generated_descriptions
  for all
  using (auth.uid() = user_id);
  