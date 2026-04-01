-- Маркет карточек: лоты и атомарные операции (только service_role)

CREATE TABLE IF NOT EXISTS public.market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price INTEGER NOT NULL CHECK (price >= 50),
  min_price_at_list INTEGER NOT NULL,
  unique_id TEXT NOT NULL UNIQUE,
  serial_id TEXT NOT NULL,
  name TEXT NOT NULL,
  anime TEXT NOT NULL,
  rarity TEXT NOT NULL,
  image_url TEXT NOT NULL,
  original_url TEXT NOT NULL,
  fallback_urls TEXT[],
  score DECIMAL NOT NULL DEFAULT 0,
  shiki_id INTEGER NOT NULL,
  character_id INTEGER NOT NULL,
  stats_hp INTEGER NOT NULL DEFAULT 0,
  stats_atk INTEGER NOT NULL DEFAULT 0,
  stats_def INTEGER NOT NULL DEFAULT 0,
  stats_spd INTEGER NOT NULL DEFAULT 0,
  stats_luck INTEGER NOT NULL DEFAULT 0,
  is_main_character BOOLEAN DEFAULT FALSE,
  pack_id TEXT,
  pack_name TEXT,
  is_art_blacklisted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_listings_seller ON public.market_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_market_listings_created ON public.market_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_listings_price ON public.market_listings(price);
CREATE INDEX IF NOT EXISTS idx_market_listings_rarity ON public.market_listings(rarity);

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_listings_read_auth" ON public.market_listings;
DROP POLICY IF EXISTS "market_listings_read_all" ON public.market_listings;
CREATE POLICY "market_listings_read_all"
  ON public.market_listings
  FOR SELECT
  USING (true);

-- Выставление: перенос карты с инвентаря в лот (валидация цены на API + здесь)
CREATE OR REPLACE FUNCTION public.market_put_listing(
  p_seller_id uuid,
  p_unique_id text,
  p_price integer,
  p_min_price integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.user_cards%ROWTYPE;
BEGIN
  IF p_price < 50 OR p_price < p_min_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price_below_min', 'min_price', p_min_price);
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

  INSERT INTO  public.market_listings (
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

-- Покупка: списание у покупателя, зачисление продавцу, карта покупателю
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
  L public.market_listings%ROWTYPE;
  buyer_coins integer;
  seller_coins integer;
BEGIN
  SELECT * INTO L FROM public.market_listings WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_found');
  END IF;

  IF L.seller_id = p_buyer_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'own_listing');
  END IF;

  SELECT coins INTO buyer_coins FROM public.user_coins WHERE id = p_buyer_id FOR UPDATE;
  IF buyer_coins IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'buyer_no_coins_row');
  END IF;

  IF buyer_coins < L.price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_coins', 'need', L.price, 'have', buyer_coins);
  END IF;

  SELECT coins INTO seller_coins FROM public.user_coins WHERE id = L.seller_id FOR UPDATE;
  IF seller_coins IS NULL THEN
    seller_coins := 10000;
    INSERT INTO public.user_coins (id, coins, updated_at) VALUES (L.seller_id, seller_coins, now());
  END IF;

  UPDATE public.user_coins
  SET coins = buyer_coins - L.price, updated_at = now()
  WHERE id = p_buyer_id;

  UPDATE public.user_coins
  SET coins = seller_coins + L.price, updated_at = now()
  WHERE id = L.seller_id;

  INSERT INTO public.user_cards (
    user_id, unique_id, serial_id, name, anime, rarity, image_url, original_url, fallback_urls,
    score, shiki_id, character_id, stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, pack_id, pack_name, is_art_blacklisted
  ) VALUES (
    p_buyer_id, L.unique_id, L.serial_id, L.name, L.anime, L.rarity, L.image_url, L.original_url, L.fallback_urls,
    L.score, L.shiki_id, L.character_id, L.stats_hp, L.stats_atk, L.stats_def, L.stats_spd, L.stats_luck,
    COALESCE(L.is_main_character, false), L.pack_id, L.pack_name, COALESCE(L.is_art_blacklisted, false)
  );

  DELETE FROM public.market_listings WHERE id = p_listing_id;

  RETURN jsonb_build_object('ok', true, 'unique_id', L.unique_id);
END;
$$;

-- Отмена лота продавцом: возврат карты
CREATE OR REPLACE FUNCTION public.market_cancel_listing(
  p_seller_id uuid,
  p_listing_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  L public.market_listings%ROWTYPE;
BEGIN
  SELECT * INTO L
  FROM public.market_listings
  WHERE id = p_listing_id AND seller_id = p_seller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'listing_not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_cards WHERE user_id = p_seller_id AND unique_id = L.unique_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate_card');
  END IF;

  INSERT INTO public.user_cards (
    user_id, unique_id, serial_id, name, anime, rarity, image_url, original_url, fallback_urls,
    score, shiki_id, character_id, stats_hp, stats_atk, stats_def, stats_spd, stats_luck,
    is_main_character, pack_id, pack_name, is_art_blacklisted
  ) VALUES (
    p_seller_id, L.unique_id, L.serial_id, L.name, L.anime, L.rarity, L.image_url, L.original_url, L.fallback_urls,
    L.score, L.shiki_id, L.character_id, L.stats_hp, L.stats_atk, L.stats_def, L.stats_spd, L.stats_luck,
    COALESCE(L.is_main_character, false), L.pack_id, L.pack_name, COALESCE(L.is_art_blacklisted, false)
  );

  DELETE FROM public.market_listings WHERE id = p_listing_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.market_put_listing(uuid, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.market_execute_purchase(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.market_cancel_listing(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.market_put_listing(uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.market_execute_purchase(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.market_cancel_listing(uuid, uuid) TO service_role;

COMMENT ON TABLE public.market_listings IS 'Карты, выставленные на маркет';
