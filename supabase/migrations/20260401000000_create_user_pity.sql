-- Migration: Add user_pity table for gacha pity system
-- Run this in Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Create user_pity table
CREATE TABLE IF NOT EXISTS public.user_pity (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bad_luck_streak INTEGER NOT NULL DEFAULT 0,
  last_rare_roll TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_pity_id ON public.user_pity(id);

-- Enable RLS
ALTER TABLE public.user_pity ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own pity" ON public.user_pity;
DROP POLICY IF EXISTS "Users can update own pity" ON public.user_pity;

-- Policy: Users can view their own pity data
CREATE POLICY "Users can view own pity"
  ON public.user_pity
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own pity data
CREATE POLICY "Users can update own pity"
  ON public.user_pity
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Function to automatically create pity record for new users
CREATE OR REPLACE FUNCTION public.create_user_pity_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_pity (id, bad_luck_streak)
  VALUES (NEW.id, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create pity record when new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created_create_pity ON auth.users;
CREATE TRIGGER on_auth_user_created_create_pity
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_pity_on_signup();

-- Create pity records for existing users (fix for users created before migration)
INSERT INTO public.user_pity (id, bad_luck_streak)
SELECT u.id, 0
FROM auth.users u
LEFT JOIN public.user_pity up ON u.id = up.id
WHERE up.id IS NULL
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.user_pity IS 'Stores gacha pity system data for each user';
COMMENT ON COLUMN public.user_pity.id IS 'User ID (UUID from auth.users)';
COMMENT ON COLUMN public.user_pity.bad_luck_streak IS 'Counter for consecutive non-rare+ rolls';
COMMENT ON COLUMN public.user_pity.last_rare_roll IS 'Timestamp of last rare+ roll';
