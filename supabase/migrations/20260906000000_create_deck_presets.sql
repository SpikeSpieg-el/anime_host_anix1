-- Migration: Create deck_presets table for saving up to 6 deck presets per user
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.deck_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL CHECK (slot_number >= 1 AND slot_number <= 6),
  name TEXT NOT NULL DEFAULT 'Пресет',
  card_ids TEXT[] NOT NULL DEFAULT '{}',
  leader_id TEXT,
  formation TEXT NOT NULL DEFAULT 'balance' CHECK (formation IN ('aggression', 'defense', 'balance')),
  is_pvp BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slot_number, is_pvp)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_deck_presets_user_id ON public.deck_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_deck_presets_user_pvp ON public.deck_presets(user_id, is_pvp);

-- Enable RLS
ALTER TABLE public.deck_presets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own presets" ON public.deck_presets;
DROP POLICY IF EXISTS "Users can insert own presets" ON public.deck_presets;
DROP POLICY IF EXISTS "Users can update own presets" ON public.deck_presets;
DROP POLICY IF EXISTS "Users can delete own presets" ON public.deck_presets;

-- Policy: Users can view their own presets
CREATE POLICY "Users can view own presets"
  ON public.deck_presets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own presets
CREATE POLICY "Users can insert own presets"
  ON public.deck_presets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own presets
CREATE POLICY "Users can update own presets"
  ON public.deck_presets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own presets
CREATE POLICY "Users can delete own presets"
  ON public.deck_presets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_deck_preset_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS on_deck_presets_update ON public.deck_presets;
CREATE TRIGGER on_deck_presets_update
  BEFORE UPDATE ON public.deck_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_deck_preset_updated_at();

COMMENT ON TABLE public.deck_presets IS 'Stores up to 6 deck presets per user for PvP and PvE';
COMMENT ON COLUMN public.deck_presets.user_id IS 'User ID (UUID from auth.users)';
COMMENT ON COLUMN public.deck_presets.slot_number IS 'Preset slot (1-6)';
COMMENT ON COLUMN public.deck_presets.name IS 'Custom name for the preset';
COMMENT ON COLUMN public.deck_presets.card_ids IS 'Array of card unique_ids in the deck';
COMMENT ON COLUMN public.deck_presets.leader_id IS 'Unique ID of the leader card';
COMMENT ON COLUMN public.deck_presets.formation IS 'Battle formation (aggression, defense, balance)';
COMMENT ON COLUMN public.deck_presets.is_pvp IS 'True for PvP presets, false for PvE presets';
