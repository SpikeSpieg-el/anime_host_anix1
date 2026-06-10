-- Добавление image_url в market_sales_history для отображения изображений проданных карт
-- А также обновление функции покупки для сохранения этого URL

ALTER TABLE public.market_sales_history
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Обновляем функцию market_execute_purchase
CREATE OR REPLACE FUNCTION public.market_execute_purchase(
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

  -- Записываем продажу в историю (теперь с image_url)
  INSERT INTO public.market_sales_history (
    listing_id, seller_id, buyer_id, price, unique_id, serial_id, name, anime, rarity,
    character_id, image_url,
    stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, frame_modifier, coating_modifier
  )
  SELECT
    id, seller_id, p_buyer_id, price, unique_id, serial_id, name, anime, rarity,
    character_id, image_url,
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
