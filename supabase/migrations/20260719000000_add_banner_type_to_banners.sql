-- Migration: Add banner_type column to banners table
-- Allows distinguishing between standard (manual) and dynamic (auto-rotating ongoing anime) banners

ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS banner_type TEXT NOT NULL DEFAULT 'standard';

COMMENT ON COLUMN public.banners.banner_type IS 'Banner type: standard (manual cards/anime) or dynamic (auto-rotating ongoing anime with guaranteed main character)';
