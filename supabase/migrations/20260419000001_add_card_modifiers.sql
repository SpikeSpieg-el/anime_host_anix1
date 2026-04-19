-- Migration: Add frame_modifier and coating_modifier columns to user_cards table
-- Run this in Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Add frame_modifier column
ALTER TABLE public.user_cards ADD COLUMN IF NOT EXISTS frame_modifier TEXT;

-- Add coating_modifier column  
ALTER TABLE public.user_cards ADD COLUMN IF NOT EXISTS coating_modifier TEXT;

-- Add comments
COMMENT ON COLUMN public.user_cards.frame_modifier IS 'Card frame modifier (gold, neon, crystal, dark, blood)';
COMMENT ON COLUMN public.user_cards.coating_modifier IS 'Card coating modifier (holo, prismatic, gold_leaf, blood_stain, void)';
