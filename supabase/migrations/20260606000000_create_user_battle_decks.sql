-- Migration: Create user_battle_decks table for saving battle decks
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.user_battle_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_ids TEXT[] NOT NULL DEFAULT '{}',
  leader_id TEXT,
  formation TEXT NOT NULL DEFAULT 'balance' CHECK (formation IN ('aggression', 'defense', 'balance')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_battle_decks_user_id ON public.user_battle_decks(user_id);

-- Enable RLS
ALTER TABLE public.user_battle_decks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own deck" ON public.user_battle_decks;
DROP POLICY IF EXISTS "Users can insert own deck" ON public.user_battle_decks;
DROP POLICY IF EXISTS "Users can update own deck" ON public.user_battle_decks;
DROP POLICY IF EXISTS "Users can delete own deck" ON public.user_battle_decks;

-- Policy: Users can view their own deck
CREATE POLICY "Users can view own deck"
  ON public.user_battle_decks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own deck
CREATE POLICY "Users can insert own deck"
  ON public.user_battle_decks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own deck
CREATE POLICY "Users can update own deck"
  ON public.user_battle_decks
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own deck
CREATE POLICY "Users can delete own deck"
  ON public.user_battle_decks
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_battle_deck_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS on_user_battle_decks_update ON public.user_battle_decks;
CREATE TRIGGER on_user_battle_decks_update
  BEFORE UPDATE ON public.user_battle_decks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_battle_deck_updated_at();

-- Create deck for existing users
INSERT INTO public.user_battle_decks (user_id, card_ids, leader_id, formation)
SELECT u.id, '{}', NULL, 'balance'
FROM auth.users u
LEFT JOIN public.user_battle_decks ubd ON u.id = ubd.user_id
WHERE ubd.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Function to create deck on signup
CREATE OR REPLACE FUNCTION public.create_user_battle_deck_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_battle_decks (user_id, card_ids, leader_id, formation)
  VALUES (NEW.id, '{}', NULL, 'balance');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_create_battle_deck ON auth.users;
CREATE TRIGGER on_auth_user_created_create_battle_deck
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_battle_deck_on_signup();

COMMENT ON TABLE public.user_battle_decks IS 'Stores saved battle decks for each user';
COMMENT ON COLUMN public.user_battle_decks.user_id IS 'User ID (UUID from auth.users)';
COMMENT ON COLUMN public.user_battle_decks.card_ids IS 'Array of card unique_ids in the deck';
COMMENT ON COLUMN public.user_battle_decks.leader_id IS 'Unique ID of the leader card';
COMMENT ON COLUMN public.user_battle_decks.formation IS 'Battle formation (aggression, defense, balance)';
