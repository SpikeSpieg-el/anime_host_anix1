-- Add guaranteed_cards_pool column to banners table
-- Stores a JSONB array of card payloads for multi-card guaranteed pity system
-- When pity hits, a random uncollected card from the pool is awarded
-- Collected cards are tracked in user_banner_pulls.collected_guaranteed_cards
-- When all cards are collected, the cycle resets

ALTER TABLE banners ADD COLUMN IF NOT EXISTS guaranteed_cards_pool JSONB DEFAULT NULL;
