-- Migration: Add user_dust table for gacha dust currency
-- Run this in Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Create user_dust table
CREATE TABLE IF NOT EXISTS public.user_dust (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dust INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_dust_id ON public.user_dust(id);

-- Enable RLS
ALTER TABLE public.user_dust ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own dust" ON public.user_dust;
DROP POLICY IF EXISTS "Users can update own dust" ON public.user_dust;

-- Policy: Users can view their own dust data
CREATE POLICY "Users can view own dust"
  ON public.user_dust
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own dust data
CREATE POLICY "Users can update own dust"
  ON public.user_dust
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Function to automatically create dust record for new users
CREATE OR REPLACE FUNCTION public.create_user_dust_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_dust (id, dust)
  VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create dust record when new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created_create_dust ON auth.users;
CREATE TRIGGER on_auth_user_created_create_dust
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_dust_on_signup();

-- Create dust records for existing users (fix for users created before migration)
INSERT INTO public.user_dust (id, dust)
SELECT u.id, 0
FROM auth.users u
LEFT JOIN public.user_dust ud ON u.id = ud.id
WHERE ud.id IS NULL
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.user_dust IS 'Stores gacha dust balance for each user';
COMMENT ON COLUMN public.user_dust.id IS 'User ID (UUID from auth.users)';
COMMENT ON COLUMN public.user_dust.dust IS 'Current dust balance (default: 0 for new users)';
