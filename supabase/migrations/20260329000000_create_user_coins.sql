-- Migration: Add user_coins table for gacha currency
-- Run this in Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Create user_coins table
CREATE TABLE IF NOT EXISTS public.user_coins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INTEGER NOT NULL DEFAULT 10000,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_coins_id ON public.user_coins(id);

-- Enable RLS
ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own coins" ON public.user_coins;
DROP POLICY IF EXISTS "Users can update own coins" ON public.user_coins;

-- Policy: Users can view their own coins
CREATE POLICY "Users can view own coins"
  ON public.user_coins
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own coins
CREATE POLICY "Users can update own coins"
  ON public.user_coins
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Function to automatically create coins record for new users
CREATE OR REPLACE FUNCTION public.create_user_coins_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_coins (id, coins)
  VALUES (NEW.id, 10000);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create coins record when new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created_create_coins ON auth.users;
CREATE TRIGGER on_auth_user_created_create_coins
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_coins_on_signup();

-- Create coins records for existing users (fix for users created before migration)
INSERT INTO public.user_coins (id, coins)
SELECT u.id, 10000
FROM auth.users u
LEFT JOIN public.user_coins uc ON u.id = uc.id
WHERE uc.id IS NULL
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.user_coins IS 'Stores gacha coins balance for each user';
COMMENT ON COLUMN public.user_coins.id IS 'User ID (UUID from auth.users)';
COMMENT ON COLUMN public.user_coins.coins IS 'Current coins balance (default: 10000 for new users)';
