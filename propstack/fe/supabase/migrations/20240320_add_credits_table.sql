-- Create timestamp trigger function
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create credits table
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add trigger to update updated_at
CREATE TRIGGER set_credits_timestamp
  BEFORE UPDATE ON credits
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Add RLS policies
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own credits" ON credits;
DROP POLICY IF EXISTS "Service role can manage all credits" ON credits;
DROP POLICY IF EXISTS "Service role can insert credits" ON credits;

-- Create new policies
CREATE POLICY "Users can view their own credits"
  ON credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credits"
  ON credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credits"
  ON credits FOR UPDATE
  USING (auth.uid() = user_id);

-- Update the function to use the current user's ID
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  RAISE LOG 'Creating initial credits for user: %', NEW.id;
  INSERT INTO public.credits (user_id, balance)
  VALUES (NEW.id, 5);
  RAISE LOG 'Credits created successfully';
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error creating credits: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger on the correct schema
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
  