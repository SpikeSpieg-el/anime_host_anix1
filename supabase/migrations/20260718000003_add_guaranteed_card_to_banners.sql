-- Migration: Add guaranteed custom card fields to banners table
-- Adds ability to configure a specific guaranteed card with pity counter

ALTER TABLE public.banners
  ADD COLUMN IF NOT EXISTS guaranteed_card_payload JSONB,
  ADD COLUMN IF NOT EXISTS guaranteed_card_pity INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.banners.guaranteed_card_payload IS 'Specific custom card guaranteed after pity count pulls (JSONB Card object)';
COMMENT ON COLUMN public.banners.guaranteed_card_pity IS 'Number of pulls before guaranteed card is awarded (0 = disabled)';
