-- Migration: Add user_cards table for gacha card collection
-- Run this in Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Create user_cards table
CREATE TABLE IF NOT EXISTS public.user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unique_id TEXT NOT NULL,
  serial_id TEXT NOT NULL,
  name TEXT NOT NULL,
  anime TEXT NOT NULL,
  rarity TEXT NOT NULL,
  image_url TEXT NOT NULL,
  original_url TEXT NOT NULL,
  fallback_urls TEXT[],
  score DECIMAL NOT NULL DEFAULT 0,
  shiki_id INTEGER NOT NULL,
  character_id INTEGER NOT NULL,
  stats_hp INTEGER NOT NULL DEFAULT 0,
  stats_atk INTEGER NOT NULL DEFAULT 0,
  stats_def INTEGER NOT NULL DEFAULT 0,
  stats_spd INTEGER NOT NULL DEFAULT 0,
  stats_luck INTEGER NOT NULL DEFAULT 0,
  is_main_character BOOLEAN DEFAULT FALSE,
  pack_id TEXT,
  pack_name TEXT,
  is_art_blacklisted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON public.user_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_character_id ON public.user_cards(character_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_rarity ON public.user_cards(rarity);
CREATE INDEX IF NOT EXISTS idx_user_cards_unique_id ON public.user_cards(unique_id);

-- Enable RLS
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own cards" ON public.user_cards;
DROP POLICY IF EXISTS "Users can insert own cards" ON public.user_cards;
DROP POLICY IF EXISTS "Users can delete own cards" ON public.user_cards;

-- Policy: Users can view their own cards
CREATE POLICY "Users can view own cards"
  ON public.user_cards
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own cards
CREATE POLICY "Users can insert own cards"
  ON public.user_cards
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own cards
CREATE POLICY "Users can delete own cards"
  ON public.user_cards
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to get card count per user (optional, for stats)
CREATE OR REPLACE FUNCTION public.get_user_card_count(target_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  card_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO card_count
  FROM public.user_cards
  WHERE user_id = target_user_id;
  
  RETURN card_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.user_cards IS 'Stores gacha card collection for each user';
COMMENT ON COLUMN public.user_cards.user_id IS 'User ID (UUID from auth.users)';
COMMENT ON COLUMN public.user_cards.unique_id IS 'Unique identifier for each card instance';
COMMENT ON COLUMN public.user_cards.rarity IS 'Card rarity (trash, common, uncommon, rare, super_rare, epic, mythic, legendary, ancient, divine, transcendent, omnipotent)';
COMMENT ON COLUMN public.user_cards.stats_hp IS 'Health points stat';
COMMENT ON COLUMN public.user_cards.stats_atk IS 'Attack stat';
COMMENT ON COLUMN public.user_cards.stats_def IS 'Defense stat';
COMMENT ON COLUMN public.user_cards.stats_spd IS 'Speed stat';
COMMENT ON COLUMN public.user_cards.stats_luck IS 'Luck stat';
