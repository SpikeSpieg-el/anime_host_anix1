-- Fix PvP logs relationships
-- This migration ensures that pvp_logs links correctly to public.profiles instead of auth.users
-- This is necessary for PostgREST to find relationships for joining data

-- First, drop the existing foreign keys (linked to auth.users)
ALTER TABLE pvp_logs DROP CONSTRAINT IF EXISTS pvp_logs_player1_id_fkey;
ALTER TABLE pvp_logs DROP CONSTRAINT IF EXISTS pvp_logs_player2_id_fkey;
ALTER TABLE pvp_logs DROP CONSTRAINT IF EXISTS pvp_logs_winner_id_fkey;

-- Now, recreate them pointing to public.profiles
-- This allows PostgREST (Supabase) to automatically find the relationship
ALTER TABLE pvp_logs
  ADD CONSTRAINT pvp_logs_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT pvp_logs_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT pvp_logs_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Also check user_ladder
ALTER TABLE user_ladder DROP CONSTRAINT IF EXISTS user_ladder_user_id_fkey;
ALTER TABLE user_ladder
  ADD CONSTRAINT user_ladder_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
