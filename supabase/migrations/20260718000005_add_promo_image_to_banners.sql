-- Migration: Add promo_image_url to banners table
-- This is the promo art shown in the banner header (7:5 aspect ratio)
-- image_url is used as the card background, promo_image_url is the promo showcase art

ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS promo_image_url TEXT;

COMMENT ON COLUMN public.banners.promo_image_url IS 'URL of the promo art image shown in the banner header (7:5 aspect ratio)';
