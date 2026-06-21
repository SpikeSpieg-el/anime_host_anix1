-- Migration: Add art_position column to user_cards table
-- Stores user-adjustable art position as JSON { x: number, y: number } (percentages 0-100)

ALTER TABLE public.user_cards 
ADD COLUMN IF NOT EXISTS art_position JSONB DEFAULT '{"x": 50, "y": 50}';

COMMENT ON COLUMN public.user_cards.art_position IS 'Art position offset in percentages (0-100), default center { x: 50, y: 50 }';
