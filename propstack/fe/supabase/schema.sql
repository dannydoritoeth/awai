-- Drop existing tables
DROP TABLE IF EXISTS listing_images CASCADE;
DROP TABLE IF EXISTS social_media_content CASCADE;
DROP TABLE IF EXISTS title_checks CASCADE;
DROP TABLE IF EXISTS generated_descriptions CASCADE;
DROP TABLE IF EXISTS listings CASCADE;
DROP TABLE IF EXISTS content CASCADE;
DROP TABLE IF EXISTS agent_engagements CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS engagement_status CASCADE;

-- Create enum for engagement status
CREATE TYPE engagement_status AS ENUM (
  'new',
  'title_search',
  'review',
  'agreement'
);

-- Create agent engagements table
CREATE TABLE IF NOT EXISTS agent_engagements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status engagement_status DEFAULT 'new',
  
  -- Delivery Details
  delivery_method TEXT,
  required_date_time TIMESTAMP WITH TIME ZONE,
  
  -- Seller Details
  seller_name TEXT,
  seller_address TEXT,
  seller_phone TEXT,
  seller_email TEXT,
  
  -- Property Details
  property_address TEXT,
  sp_number TEXT,
  survey_plan_number TEXT,
  title_reference TEXT,
  sale_method TEXT,
  list_price TEXT,
  auction_details JSONB,
  
  -- Property Features
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  car_spaces INTEGER,
  pool BOOLEAN,
  body_corp BOOLEAN,
  electrical_safety_switch BOOLEAN,
  smoke_alarms BOOLEAN,
  
  -- Legal & Compliance
  seller_warranties TEXT,
  heritage_listed TEXT,
  contaminated_land TEXT,
  environment_management TEXT,
  present_land_use TEXT,
  neighbourhood_disputes TEXT,
  encumbrances TEXT,
  gst_applicable TEXT,
  authorised_marketing TEXT,
  commission DECIMAL(5,2)
);

-- Add RLS policies for agent_engagements
ALTER TABLE agent_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own engagements"
  ON agent_engagements
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create engagements"
  ON agent_engagements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their engagements"
  ON agent_engagements
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create listings table
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  
  -- Basic Details
  address TEXT NOT NULL,
  latitude DECIMAL,
  longitude DECIMAL,
  property_type TEXT,
  listing_type TEXT,
  agent_engagement_id UUID REFERENCES agent_engagements(id),
  
  -- Property Features
  price TEXT,
  currency TEXT DEFAULT '$',
  bedrooms INTEGER,
  bathrooms INTEGER,
  parking TEXT,
  lot_size TEXT,
  lot_size_unit TEXT DEFAULT 'sqft',
  interior_size TEXT,
  interior_size_unit TEXT DEFAULT 'sqft',
  
  -- Highlights and Details
  property_highlights TEXT[],
  location_highlights TEXT[],
  location_notes TEXT,
  other_details TEXT,
  
  -- Status
  status TEXT DEFAULT 'draft',
  
  -- Action Statuses
  description_status TEXT DEFAULT 'todo' 
    CHECK (description_status IN ('todo', 'pending', 'in_progress', 'completed')),
  title_check_status TEXT DEFAULT 'todo' 
    CHECK (title_check_status IN ('todo', 'pending', 'in_progress', 'completed')),
  social_media_status TEXT DEFAULT 'todo' 
    CHECK (social_media_status IN ('todo', 'pending', 'in_progress', 'completed')),
  images_status TEXT DEFAULT 'todo' 
    CHECK (images_status IN ('todo', 'uploaded', 'described', 'completed'))
);

-- Create generated descriptions table
CREATE TABLE IF NOT EXISTS generated_descriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  content TEXT,
  status TEXT CHECK (status IN ('processing', 'generating', 'completed', 'error')) DEFAULT 'processing',
  options JSONB,
  error_message TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  version INTEGER DEFAULT 1
);

-- Enable RLS
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_descriptions ENABLE ROW LEVEL SECURITY;

-- Listings policies
CREATE POLICY "Users can view their own listings"
  ON listings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own listings"
  ON listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listings"
  ON listings FOR UPDATE
  USING (auth.uid() = user_id);

-- First drop all existing policies for generated_descriptions
DROP POLICY IF EXISTS "owners can create descriptions" ON generated_descriptions;
DROP POLICY IF EXISTS "owners can view their descriptions" ON generated_descriptions;
DROP POLICY IF EXISTS "owners can update their descriptions" ON generated_descriptions;
DROP POLICY IF EXISTS "owners can delete their descriptions" ON generated_descriptions;
DROP POLICY IF EXISTS "Users can manage their own descriptions" ON generated_descriptions;
DROP POLICY IF EXISTS "Users can create descriptions for their listings" ON generated_descriptions;

-- Enable RLS
ALTER TABLE generated_descriptions ENABLE ROW LEVEL SECURITY;

-- Create simple, separate policies for each operation
CREATE POLICY "Enable insert for authenticated users only"
  ON generated_descriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Enable read access for users based on listing ownership"
  ON generated_descriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Enable update for users based on listing ownership"
  ON generated_descriptions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "Enable delete for users based on listing ownership"
  ON generated_descriptions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  );

-- Add index for better join performance
CREATE INDEX IF NOT EXISTS idx_generated_descriptions_listing_id 
  ON generated_descriptions(listing_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_property_type ON listings(property_type);
CREATE INDEX IF NOT EXISTS idx_listings_listing_type ON listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_agent_engagement_id ON listings(agent_engagement_id);

-- Create listing_images table
CREATE TABLE IF NOT EXISTS listing_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  description TEXT,
  caption TEXT,
  order_index INTEGER,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'described'))
);

-- Create social_media_content table
CREATE TABLE IF NOT EXISTS social_media_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  post_type TEXT NOT NULL, -- e.g., 'new_listing', 'price_update', 'open_house', etc.
  custom_context TEXT, -- Context for custom posts
  content_options JSONB, -- Stores AI generation options like emojis, style, etc.
  generated_content JSONB, -- Stores generated content for each platform
  selected_images UUID[], -- Array of listing_image IDs
  content TEXT, -- The final edited content
  platform TEXT CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'scheduled', 'published')),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Create trigger for updating timestamp
DROP TRIGGER IF EXISTS set_timestamp ON social_media_content;
CREATE TRIGGER set_timestamp
  BEFORE UPDATE ON social_media_content
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Enable RLS on social_media_content table
ALTER TABLE social_media_content ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can manage their social_media_content" ON social_media_content;

-- Add RLS policies for social_media_content table
CREATE POLICY "Users can manage their social_media_content"
  ON social_media_content FOR ALL
  USING (auth.uid() = user_id);

-- Drop existing indexes first
DROP INDEX IF EXISTS idx_social_media_content_listing_id;
DROP INDEX IF EXISTS idx_social_media_content_user_id;

-- Add index for social_media_content table
CREATE INDEX idx_social_media_content_listing_id ON social_media_content(listing_id);
CREATE INDEX idx_social_media_content_user_id ON social_media_content(user_id);

-- Create title_checks table
CREATE TABLE IF NOT EXISTS title_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on new tables
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE title_checks ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for new tables
CREATE POLICY "Users can manage their listing images"
  ON listing_images FOR ALL
  USING (EXISTS (
    SELECT 1 FROM listings WHERE listings.id = listing_id AND listings.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their social media content"
  ON social_media_content FOR ALL
  USING (EXISTS (
    SELECT 1 FROM listings WHERE listings.id = listing_id AND listings.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their title checks"
  ON title_checks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM listings WHERE listings.id = listing_id AND listings.user_id = auth.uid()
  ));

-- Add indexes for the new tables
CREATE INDEX idx_listing_images_listing_id ON listing_images(listing_id);
CREATE INDEX idx_title_checks_listing_id ON title_checks(listing_id);

-- Add portal sync tracking
CREATE TABLE IF NOT EXISTS description_portal_sync (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description_id UUID REFERENCES generated_descriptions(id) ON DELETE CASCADE,
  portal_id TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'synced', 'failed')) DEFAULT 'pending',
  error_message TEXT,
  synced_at TIMESTAMP WITH TIME ZONE
);

-- Update generated descriptions table
ALTER TABLE generated_descriptions 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('draft', 'approved')) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS version INTEGER;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_description_portal_sync_description_id 
  ON description_portal_sync(description_id);

-- Create storage bucket for listing images if it doesn't exist
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

-- Storage Policies
-- Drop existing policies first
drop policy if exists "Allow public access to listing images" on storage.objects;
drop policy if exists "Allow authenticated users to upload images" on storage.objects;
drop policy if exists "Allow users to delete their own images" on storage.objects;

-- Recreate policies
create policy "Allow public access to listing images"
on storage.objects for select
using (bucket_id = 'listing-images');

create policy "Allow authenticated users to upload images"
on storage.objects for insert
with check (
  bucket_id = 'listing-images' 
  and auth.role() = 'authenticated'
);

create policy "Allow users to delete their own images"
on storage.objects for delete
using (
  bucket_id = 'listing-images' 
  and auth.role() = 'authenticated'
);

-- Update listing_images table to use order_index consistently
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'listing_images'
        AND column_name = 'order'
    ) THEN
        ALTER TABLE listing_images RENAME COLUMN "order" TO order_index;
    END IF;
END $$;

-- Add index for order_index
create index if not exists idx_listing_images_order_index 
on listing_images(order_index);

-- Drop existing tables if they exist

-- Create timestamp trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create content table
CREATE TABLE IF NOT EXISTS content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  post_type TEXT NOT NULL, -- e.g., 'new_listing', 'price_update', 'open_house', etc.
  custom_context TEXT, -- Context for custom posts
  content_options JSONB, -- Stores AI generation options like emojis, style, etc.
  generated_content JSONB, -- Stores generated content for each platform
  selected_images UUID[], -- Array of listing_image IDs
  content TEXT, -- The final edited content
  platform TEXT CHECK (platform IN ('facebook', 'instagram', 'twitter', 'linkedin')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'scheduled', 'published')),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Create trigger for updating timestamp
DROP TRIGGER IF EXISTS set_timestamp ON content;
CREATE TRIGGER set_timestamp
  BEFORE UPDATE ON content
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Enable RLS on content table
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can manage their content" ON content;

-- Add RLS policies for content table
CREATE POLICY "Users can manage their content"
  ON content FOR ALL
  USING (auth.uid() = user_id);

-- Drop existing indexes first
DROP INDEX IF EXISTS idx_content_listing_id;
DROP INDEX IF EXISTS idx_content_user_id;

-- Add index for content table
CREATE INDEX idx_content_listing_id ON content(listing_id);
CREATE INDEX idx_content_user_id ON content(user_id);

-- Add new columns to social_media_content table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_media_content' AND column_name = 'selected_images') THEN
    ALTER TABLE social_media_content ADD COLUMN selected_images uuid[] DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'social_media_content' AND column_name = 'hero_image') THEN
    ALTER TABLE social_media_content ADD COLUMN hero_image uuid REFERENCES listing_images(id);
  END IF;
END $$; 