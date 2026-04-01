-- Migration: Fix authentication trigger conflicts
-- This consolidates all user creation triggers into a single trigger
-- Run this in Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- First, drop all existing individual triggers to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_create_coins ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_create_pity ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_create_dust ON auth.users;

-- Create a consolidated function that handles all user initialization
CREATE OR REPLACE FUNCTION public.handle_new_user_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile record
  INSERT INTO public.profiles (id, username, updated_at)
  VALUES (NEW.id, NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING;
  
  -- Create coins record (starting with 10000 coins for new users)
  INSERT INTO public.user_coins (id, coins)
  VALUES (NEW.id, 10000)
  ON CONFLICT (id) DO NOTHING;
  
  -- Create pity record
  INSERT INTO public.user_pity (id, bad_luck_streak)
  VALUES (NEW.id, 0)
  ON CONFLICT (id) DO NOTHING;
  
  -- Create dust record
  INSERT INTO public.user_dust (id, dust)
  VALUES (NEW.id, 0)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a single consolidated trigger
CREATE TRIGGER on_auth_user_created_complete
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_complete();

-- Clean up old individual functions that are no longer needed
DROP FUNCTION IF EXISTS public.create_user_coins_on_signup();
DROP FUNCTION IF EXISTS public.create_user_pity_on_signup();
DROP FUNCTION IF EXISTS public.create_user_dust_on_signup();

COMMENT ON FUNCTION public.handle_new_user_complete() IS 'Consolidated function to initialize all user data on signup';
