-- Потолок цены лота: параметр p_max_price в market_put_listing

DROP FUNCTION IF EXISTS public.market_put_listing(uuid, text, integer, integer);

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
DECLARE
  r public.user_cards%ROWTYPE;
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

  SELECT * INTO r
  FROM public.user_cards
  WHERE user_id = p_seller_id AND unique_id = p_unique_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.market_listings WHERE unique_id = p_unique_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_listed');
  END IF;

  INSERT INTO public.market_listings (
    seller_id, price, min_price_at_list, unique_id, serial_id, name, anime, rarity,
    image_url, original_url, fallback_urls, score, shiki_id, character_id,
    stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, pack_id, pack_name, is_art_blacklisted
  ) VALUES (
    p_seller_id, p_price, p_min_price, r.unique_id, r.serial_id, r.name, r.anime, r.rarity,
    r.image_url, r.original_url, r.fallback_urls, r.score, r.shiki_id, r.character_id,
    r.stats_hp, r.stats_atk, r.stats_def, r.stats_spd, r.stats_luck,
    COALESCE(r.is_main_character, false), r.pack_id, r.pack_name, COALESCE(r.is_art_blacklisted, false)
  );

  DELETE FROM public.user_cards
  WHERE user_id = p_seller_id AND unique_id = p_unique_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.market_put_listing(uuid, text, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_put_listing(uuid, text, integer, integer, integer) TO service_role;
