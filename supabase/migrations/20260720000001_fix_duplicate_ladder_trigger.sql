-- Fix: Remove duplicate on_auth_user_created_ladder trigger
-- The consolidated trigger on_auth_user_created_final (from 20260618000000)
-- already handles user_ladder insertion with proper exception handling.
-- The duplicate trigger created by 20260720000000_create_pvp_system_combined.sql
-- calls create_user_ladder_entry() which has NO exception handling,
-- causing "Database error saving new user" on signup if the insert fails.

-- Drop the duplicate trigger
DROP TRIGGER IF EXISTS on_auth_user_created_ladder ON auth.users;

-- Drop the now-unused function
DROP FUNCTION IF EXISTS public.create_user_ladder_entry();

-- Verify: on_auth_user_created_final should be the only trigger on auth.users
-- It already inserts into user_ladder with ON CONFLICT DO NOTHING and exception handling
