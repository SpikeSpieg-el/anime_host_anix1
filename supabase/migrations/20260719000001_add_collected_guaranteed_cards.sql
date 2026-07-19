-- Migration: Add collected_guaranteed_cards to user_banner_pulls
-- Tracks which GG cards have been collected from dynamic banner guaranteed pool

ALTER TABLE public.user_banner_pulls
  ADD COLUMN IF NOT EXISTS collected_guaranteed_cards JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.user_banner_pulls.collected_guaranteed_cards IS 'Array of character IDs collected from the guaranteed pool (for multi-GG dynamic banners)';
