-- Migration: Create banner_cards table linking banners to special/exclusive cards
-- Run this in Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Create banner_cards table (special cards that can be obtained from a banner)
CREATE TABLE IF NOT EXISTS public.banner_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_id UUID NOT NULL REFERENCES public.banners(id) ON DELETE CASCADE,
  -- Full card definition as JSONB (matches Card interface, used to insert into user_cards on pull)
  card_payload JSONB NOT NULL,
  -- Drop weight for this card in the banner pool (higher = more likely)
  weight INTEGER NOT NULL DEFAULT 1,
  -- Whether this is a featured/rate-up card (shown prominently in banner UI)
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(banner_id, card_payload)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_banner_cards_banner_id ON public.banner_cards(banner_id);
CREATE INDEX IF NOT EXISTS idx_banner_cards_is_featured ON public.banner_cards(is_featured);

-- Enable RLS
ALTER TABLE public.banner_cards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view banner cards" ON public.banner_cards;

-- Policy: Anyone can view banner cards (public content for gacha UI)
CREATE POLICY "Anyone can view banner cards"
  ON public.banner_cards
  FOR SELECT
  USING (true);

-- Note: INSERT/UPDATE/DELETE done via service role key (admin only).

COMMENT ON TABLE public.banner_cards IS 'Special/exclusive cards obtainable from a specific banner';
COMMENT ON COLUMN public.banner_cards.card_payload IS 'Full Card object as JSONB, inserted into user_cards when pulled';
COMMENT ON COLUMN public.banner_cards.weight IS 'Drop weight for probability calculation';
COMMENT ON COLUMN public.banner_cards.is_featured IS 'Whether this card is rate-up/featured in the banner UI';
