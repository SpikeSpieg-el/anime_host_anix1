-- Add art_position column to market_listings and propagate through put/purchase functions

ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS art_position JSONB DEFAULT '{"x": 50, "y": 50}';

-- Update market_put_listing to copy art_position from user_cards
CREATE OR REPLACE FUNCTION public.market_put_listing(
  p_seller_id uuid,
  p_unique_id text,
  p_price integer,
  p_min_price integer,
  p_max_price integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_max_price < p_min_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_price_bounds');
  END IF;

  IF p_price < 50 OR p_price < p_min_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_below_min', 'min_price', p_min_price);
  END IF;

  IF p_price > p_max_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_above_max', 'max_price', p_max_price);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_cards WHERE user_id = p_seller_id AND unique_id = p_unique_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.market_listings WHERE unique_id = p_unique_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_listed');
  END IF;

  INSERT INTO public.market_listings (
    seller_id, price, min_price_at_list, unique_id, serial_id, name, anime, rarity,
    image_url, original_url, fallback_urls, score, shiki_id, character_id,
    stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, pack_id, pack_name, is_art_blacklisted,
    frame_modifier, coating_modifier, art_position
  )
  SELECT
    p_seller_id, p_price, p_min_price, unique_id, serial_id, name, anime, rarity,
    image_url, original_url, fallback_urls, score, shiki_id, character_id,
    stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    COALESCE(is_main_character, false), pack_id, pack_name, COALESCE(is_art_blacklisted, false),
    frame_modifier, coating_modifier, COALESCE(art_position, '{"x": 50, "y": 50}'::jsonb)
  FROM public.user_cards
  WHERE user_id = p_seller_id AND unique_id = p_unique_id;

  DELETE FROM public.user_cards
  WHERE user_id = p_seller_id AND unique_id = p_unique_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Update market_execute_purchase to copy art_position to buyer's user_cards
CREATE OR REPLACE FUNCTION public.market_execute_purchase(
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
  SELECT * INTO v_listing
  FROM public.market_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_found');
  END IF;

  IF v_listing.seller_id = p_buyer_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'own_listing');
  END IF;

  IF v_listing.reserved_by IS NOT NULL
     AND v_listing.reserved_by != p_buyer_id
     AND v_listing.reserved_at > now() - interval '15 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reserved');
  END IF;

  SELECT coins INTO v_buyer_coins
  FROM public.user_coins
  WHERE id = p_buyer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'buyer_no_coins_row');
  END IF;

  IF v_buyer_coins < v_listing.price THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'insufficient_coins',
      'need', v_listing.price, 'have', v_buyer_coins
    );
  END IF;

  INSERT INTO public.user_coins (id, coins, updated_at)
  VALUES (v_listing.seller_id, 10000, now())
  ON CONFLICT (id) DO NOTHING;

  PERFORM 1 FROM public.user_coins WHERE id = v_listing.seller_id FOR UPDATE;

  UPDATE public.user_coins
  SET coins = coins - v_listing.price, updated_at = now()
  WHERE id = p_buyer_id;

  UPDATE public.user_coins
  SET coins = coins + v_listing.price, updated_at = now()
  WHERE id = v_listing.seller_id;

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

  INSERT INTO public.user_cards (
    user_id, unique_id, serial_id, name, anime, rarity, image_url, original_url, fallback_urls,
    score, shiki_id, character_id, stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, pack_id, pack_name, is_art_blacklisted, frame_modifier, coating_modifier,
    art_position
  )
  VALUES (
    p_buyer_id, v_listing.unique_id, v_listing.serial_id, v_listing.name, v_listing.anime, v_listing.rarity,
    v_listing.image_url, v_listing.original_url, v_listing.fallback_urls,
    v_listing.score, v_listing.shiki_id, v_listing.character_id,
    v_listing.stats_hp, v_listing.stats_atk, v_listing.stats_def, v_listing.stats_spd, v_listing.stats_luck,
    COALESCE(v_listing.is_main_character, false), v_listing.pack_id, v_listing.pack_name,
    COALESCE(v_listing.is_art_blacklisted, false), v_listing.frame_modifier, v_listing.coating_modifier,
    COALESCE(v_listing.art_position, '{"x": 50, "y": 50}'::jsonb)
  );

  DELETE FROM public.market_listings WHERE id = p_listing_id;

  RETURN jsonb_build_object('ok', true, 'unique_id', v_listing.unique_id);
END;
$$;
