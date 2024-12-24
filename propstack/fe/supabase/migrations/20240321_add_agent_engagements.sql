-- Create enum for engagement status
CREATE TYPE engagement_status AS ENUM (
  'new',
  'title_search',
  'review',
  'agreement'
);

-- Create agent engagements table
CREATE TABLE agent_engagements (
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

-- Add RLS policies
ALTER TABLE agent_engagements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own engagements" ON agent_engagements;
DROP POLICY IF EXISTS "Users can create engagements" ON agent_engagements;
DROP POLICY IF EXISTS "Users can update their engagements" ON agent_engagements;

-- Create new policies
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

-- Add updated_at trigger
CREATE TRIGGER set_agent_engagements_timestamp
  BEFORE UPDATE ON agent_engagements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp(); 

-- Update the engagement status enum if needed
ALTER TYPE engagement_status ADD VALUE IF NOT EXISTS 'title_search'; 