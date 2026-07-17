-- Migration: Create banners table for gacha events/banners
-- Run this in Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Create banners table (event banners with featured anime + boosted rates)
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  -- Image/banner art URL
  image_url TEXT,
  -- Shikimori anime IDs featured in this banner (pool of characters)
  featured_anime_ids INTEGER[] NOT NULL DEFAULT '{}',
  -- Boosted rarity: cards pulled from this banner get this as guaranteed minimum
  boosted_rarity TEXT,
  -- Price per pull (coins). If NULL, uses default pack pricing logic.
  price INTEGER,
  -- Banner color gradient (tailwind classes) for UI
  color TEXT DEFAULT 'from-purple-600 to-pink-700',
  -- Scheduling
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Sort order for display
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_banners_is_active ON public.banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_dates ON public.banners(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_banners_sort_order ON public.banners(sort_order);

-- Enable RLS
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view banners" ON public.banners;

-- Policy: Anyone (even anon) can view banners - they're public content
CREATE POLICY "Anyone can view banners"
  ON public.banners
  FOR SELECT
  USING (true);

-- Note: INSERT/UPDATE/DELETE done via service role key (admin only), no user policies.

COMMENT ON TABLE public.banners IS 'Gacha event banners with featured anime and boosted rarity';
COMMENT ON COLUMN public.banners.featured_anime_ids IS 'Shikimori anime IDs that define the card pool for this banner';
COMMENT ON COLUMN public.banners.boosted_rarity IS 'Guaranteed minimum rarity for pulls from this banner';
