-- Migration: Fix ALL authentication trigger conflicts
-- This consolidates ALL user creation triggers into a single trigger
-- Run this in Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Drop ALL existing triggers on auth.users to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_complete ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_final ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_create_coins ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_create_pity ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_create_dust ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_create_battle_progress ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_create_battle_deck ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_ladder ON auth.users;

-- Drop old individual functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_new_user_complete();
DROP FUNCTION IF EXISTS public.create_user_coins_on_signup();
DROP FUNCTION IF EXISTS public.create_user_pity_on_signup();
DROP FUNCTION IF EXISTS public.create_user_dust_on_signup();
DROP FUNCTION IF EXISTS public.create_user_battle_progress_on_signup();
DROP FUNCTION IF EXISTS public.create_user_battle_deck_on_signup();
DROP FUNCTION IF EXISTS public.create_user_ladder_entry();

-- Create a single consolidated function that handles ALL user initialization
CREATE OR REPLACE FUNCTION public.handle_new_user_final()
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
  
  -- Create battle progress record
  INSERT INTO public.user_battle_progress (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create battle deck record
  INSERT INTO public.user_battle_decks (user_id, card_ids, leader_id, formation)
  VALUES (NEW.id, '{}', NULL, 'balance')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create PvP ladder entry
  INSERT INTO public.user_ladder (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a single consolidated trigger
CREATE TRIGGER on_auth_user_created_final
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_final();

COMMENT ON FUNCTION public.handle_new_user_final() IS 'Final consolidated function to initialize all user data on signup (profiles, coins, pity, dust, battle progress, battle decks, PvP ladder)';
