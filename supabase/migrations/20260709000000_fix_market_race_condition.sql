-- Fix race condition in market_execute_purchase + add reservation system
-- Problem: two buyers could simultaneously pass the IF NOT EXISTS checks.
-- Also, when two users click "Buy" at the same time, it's unclear who gets the card.
-- Solution:
-- 1. SELECT ... FOR UPDATE to lock the listing row atomically
-- 2. Reservation system: when a user opens the buy dialog, the card is reserved
--    for 15 seconds. Other users see "Забронировано" and can't buy it.

-- Add reservation columns to market_listings
ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS reserved_by uuid,
  ADD COLUMN IF NOT EXISTS reserved_at timestamptz;

-- Function to reserve a listing
CREATE OR REPLACE FUNCTION public.market_reserve_listing(
  p_listing_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT * INTO v_row
  FROM public.market_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_found');
  END IF;

  -- Already reserved by someone else and not expired?
  IF v_row.reserved_by IS NOT NULL
     AND v_row.reserved_by != p_user_id
     AND v_row.reserved_at > now() - interval '15 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reserved');
  END IF;

  -- Reserve for this user
  UPDATE public.market_listings
  SET reserved_by = p_user_id, reserved_at = now()
  WHERE id = p_listing_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Function to release a reservation
CREATE OR REPLACE FUNCTION public.market_release_reservation(
  p_listing_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.market_listings
  SET reserved_by = NULL, reserved_at = NULL
  WHERE id = p_listing_id AND reserved_by = p_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

DROP FUNCTION IF EXISTS public.market_execute_purchase(uuid, uuid);

CREATE FUNCTION public.market_execute_purchase(
  p_listing_id uuid,
  p_buyer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing RECORD;
  v_buyer_coins integer;
BEGIN
  -- Lock the listing row. Second concurrent buyer blocks here until
  -- the first transaction commits (and deletes the row).
  SELECT * INTO v_listing
  FROM public.market_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_found');
  END IF;

  -- Check not own listing
  IF v_listing.seller_id = p_buyer_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'own_listing');
  END IF;

  -- Check reservation: if reserved by someone else and not expired, reject
  IF v_listing.reserved_by IS NOT NULL
     AND v_listing.reserved_by != p_buyer_id
     AND v_listing.reserved_at > now() - interval '15 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reserved');
  END IF;

  -- Lock and check buyer's coins row
  SELECT coins INTO v_buyer_coins
  FROM public.user_coins
  WHERE id = p_buyer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'buyer_no_coins_row');
  END IF;

  -- Check sufficient coins
  IF v_buyer_coins < v_listing.price THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'insufficient_coins',
      'need', v_listing.price, 'have', v_buyer_coins
    );
  END IF;

  -- Ensure seller has a coins row (insert with default if missing)
  INSERT INTO public.user_coins (id, coins, updated_at)
  VALUES (v_listing.seller_id, 10000, now())
  ON CONFLICT (id) DO NOTHING;

  -- Lock seller's coins row for safe update
  PERFORM 1 FROM public.user_coins WHERE id = v_listing.seller_id FOR UPDATE;

  -- Deduct buyer coins
  UPDATE public.user_coins
  SET coins = coins - v_listing.price, updated_at = now()
  WHERE id = p_buyer_id;

  -- Add seller coins
  UPDATE public.user_coins
  SET coins = coins + v_listing.price, updated_at = now()
  WHERE id = v_listing.seller_id;

  -- Record sale in history
  INSERT INTO public.market_sales_history (
    listing_id, seller_id, buyer_id, price, unique_id, serial_id, name, anime, rarity,
    character_id,
    stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, frame_modifier, coating_modifier
  )
  VALUES (
    v_listing.id, v_listing.seller_id, p_buyer_id, v_listing.price,
    v_listing.unique_id, v_listing.serial_id, v_listing.name, v_listing.anime, v_listing.rarity,
    v_listing.character_id,
    v_listing.stats_hp, v_listing.stats_atk, v_listing.stats_def, v_listing.stats_spd, v_listing.stats_luck,
    COALESCE(v_listing.is_main_character, false), v_listing.frame_modifier, v_listing.coating_modifier
  );

  -- Add card to buyer's collection
  INSERT INTO public.user_cards (
    user_id, unique_id, serial_id, name, anime, rarity, image_url, original_url, fallback_urls,
    score, shiki_id, character_id, stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, pack_id, pack_name, is_art_blacklisted, frame_modifier, coating_modifier
  )
  VALUES (
    p_buyer_id, v_listing.unique_id, v_listing.serial_id, v_listing.name, v_listing.anime, v_listing.rarity,
    v_listing.image_url, v_listing.original_url, v_listing.fallback_urls,
    v_listing.score, v_listing.shiki_id, v_listing.character_id,
    v_listing.stats_hp, v_listing.stats_atk, v_listing.stats_def, v_listing.stats_spd, v_listing.stats_luck,
    COALESCE(v_listing.is_main_character, false), v_listing.pack_id, v_listing.pack_name,
    COALESCE(v_listing.is_art_blacklisted, false), v_listing.frame_modifier, v_listing.coating_modifier
  );

  -- Delete the listing (already locked, so this is safe)
  DELETE FROM public.market_listings WHERE id = p_listing_id;

  RETURN jsonb_build_object('ok', true, 'unique_id', v_listing.unique_id);
END;
$$;
