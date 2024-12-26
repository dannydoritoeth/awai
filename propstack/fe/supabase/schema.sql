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
  status TEXT DEFAULT 'draft'
);

-- Create generated descriptions table
CREATE TABLE IF NOT EXISTS generated_descriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  content TEXT,
  status TEXT CHECK (status IN ('processing', 'generating', 'completed', 'error')) DEFAULT 'processing'
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

-- Generated descriptions policies
CREATE POLICY "owners can create descriptions"
  ON generated_descriptions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "owners can view their descriptions"
  ON generated_descriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "owners can update their descriptions"
  ON generated_descriptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  );

CREATE POLICY "owners can delete their descriptions"
  ON generated_descriptions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_id
      AND listings.user_id = auth.uid()
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_property_type ON listings(property_type);
CREATE INDEX IF NOT EXISTS idx_listings_listing_type ON listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC); 