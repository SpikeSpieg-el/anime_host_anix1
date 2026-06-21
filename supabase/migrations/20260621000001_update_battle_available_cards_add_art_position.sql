-- Migration: Update get_battle_available_cards to include art_position column

DROP FUNCTION IF EXISTS public.get_battle_available_cards(uuid);

CREATE OR REPLACE FUNCTION public.get_battle_available_cards(
  p_user_id uuid
)
RETURNS TABLE (
  unique_id text,
  name text,
  anime text,
  rarity text,
  image_url text,
  stats_hp integer,
  stats_atk integer,
  stats_def integer,
  stats_spd integer,
  stats_luck integer,
  is_main_character boolean,
  score decimal,
  art_position jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uc.unique_id,
    uc.name,
    uc.anime,
    uc.rarity,
    uc.image_url,
    uc.stats_hp,
    uc.stats_atk,
    uc.stats_def,
    uc.stats_spd,
    uc.stats_luck,
    uc.is_main_character,
    uc.score,
    uc.art_position
  FROM public.user_cards uc
  WHERE uc.user_id = p_user_id
    AND NOT EXISTS (
      SELECT 1 
      FROM public.market_listings ml 
      WHERE ml.unique_id = uc.unique_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_battle_available_cards(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_battle_available_cards(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_battle_available_cards(uuid) TO service_role;
