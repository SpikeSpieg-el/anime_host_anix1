-- Обновление функций рынка для отслеживания модификаторов в истории продаж

-- Удаляем старые функции
DROP FUNCTION IF EXISTS public.market_put_listing(uuid, text, integer, integer, integer);
DROP FUNCTION IF EXISTS public.market_execute_purchase(uuid, uuid);
DROP FUNCTION IF EXISTS public.market_cancel_listing(uuid, uuid);

-- Создаём функцию market_put_listing для сохранения модификаторов
CREATE FUNCTION public.market_put_listing(
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
    frame_modifier, coating_modifier
  )
  SELECT
    p_seller_id, p_price, p_min_price, unique_id, serial_id, name, anime, rarity,
    image_url, original_url, fallback_urls, score, shiki_id, character_id,
    stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    COALESCE(is_main_character, false), pack_id, pack_name, COALESCE(is_art_blacklisted, false),
    frame_modifier, coating_modifier
  FROM public.user_cards
  WHERE user_id = p_seller_id AND unique_id = p_unique_id;

  DELETE FROM public.user_cards
  WHERE user_id = p_seller_id AND unique_id = p_unique_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Создаём функцию market_execute_purchase для записи в историю продаж
CREATE FUNCTION public.market_execute_purchase(
  p_listing_id uuid,
  p_buyer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.market_listings WHERE id = p_listing_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.market_listings WHERE id = p_listing_id AND seller_id = p_buyer_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'own_listing');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_coins WHERE id = p_buyer_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'buyer_no_coins_row');
  END IF;

  IF (SELECT coins FROM public.user_coins WHERE id = p_buyer_id) < (SELECT price FROM public.market_listings WHERE id = p_listing_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_coins', 'need', (SELECT price FROM public.market_listings WHERE id = p_listing_id), 'have', (SELECT coins FROM public.user_coins WHERE id = p_buyer_id));
  END IF;

  INSERT INTO public.user_coins (id, coins, updated_at)
  SELECT id, 10000, now()
  FROM public.market_listings
  WHERE id = p_listing_id
  AND NOT EXISTS (SELECT 1 FROM public.user_coins WHERE id = seller_id);

  UPDATE public.user_coins
  SET coins = coins - (SELECT price FROM public.market_listings WHERE id = p_listing_id), updated_at = now()
  WHERE id = p_buyer_id;

  UPDATE public.user_coins
  SET coins = coins + (SELECT price FROM public.market_listings WHERE id = p_listing_id), updated_at = now()
  WHERE id = (SELECT seller_id FROM public.market_listings WHERE id = p_listing_id);

  -- Записываем продажу в историю
  INSERT INTO public.market_sales_history (
    listing_id, seller_id, buyer_id, price, unique_id, serial_id, name, anime, rarity,
    stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, frame_modifier, coating_modifier
  )
  SELECT
    id, seller_id, p_buyer_id, price, unique_id, serial_id, name, anime, rarity,
    stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    COALESCE(is_main_character, false), frame_modifier, coating_modifier
  FROM public.market_listings
  WHERE id = p_listing_id;

  INSERT INTO public.user_cards (
    user_id, unique_id, serial_id, name, anime, rarity, image_url, original_url, fallback_urls,
    score, shiki_id, character_id, stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, pack_id, pack_name, is_art_blacklisted, frame_modifier, coating_modifier
  )
  SELECT
    p_buyer_id, unique_id, serial_id, name, anime, rarity, image_url, original_url, fallback_urls,
    score, shiki_id, character_id, stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    COALESCE(is_main_character, false), pack_id, pack_name, COALESCE(is_art_blacklisted, false),
    frame_modifier, coating_modifier
  FROM public.market_listings
  WHERE id = p_listing_id;

  DELETE FROM public.market_listings WHERE id = p_listing_id;

  RETURN jsonb_build_object('ok', true, 'unique_id', (SELECT unique_id FROM public.market_listings WHERE id = p_listing_id));
END;
$$;

-- Создаём функцию market_cancel_listing для возврата модификаторов
CREATE FUNCTION public.market_cancel_listing(
  p_seller_id uuid,
  p_listing_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.market_listings WHERE id = p_listing_id AND seller_id = p_seller_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_found');
  END IF;

  -- Удаляем дубликат карты если есть (на случай race condition)
  DELETE FROM public.user_cards
  WHERE user_id = p_seller_id
  AND unique_id = (SELECT unique_id FROM public.market_listings WHERE id = p_listing_id);

  INSERT INTO public.user_cards (
    user_id, unique_id, serial_id, name, anime, rarity, image_url, original_url, fallback_urls,
    score, shiki_id, character_id, stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, pack_id, pack_name, is_art_blacklisted, frame_modifier, coating_modifier
  )
  SELECT
    p_seller_id, unique_id, serial_id, name, anime, rarity, image_url, original_url, fallback_urls,
    score, shiki_id, character_id, stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    COALESCE(is_main_character, false), pack_id, pack_name, COALESCE(is_art_blacklisted, false),
    frame_modifier, coating_modifier
  FROM public.market_listings
  WHERE id = p_listing_id AND seller_id = p_seller_id;

  DELETE FROM public.market_listings WHERE id = p_listing_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
