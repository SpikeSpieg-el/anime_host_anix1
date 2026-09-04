CREATE OR REPLACE FUNCTION public.handle_new_user_final()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id UUID;
  inserted_count INTEGER;
  bonus_amount INTEGER := 2000;
  gift_card_payload JSONB;
  gift_card_unique_id TEXT;
  gift_card_serial_id TEXT;
  gift_card_name TEXT;
  gift_card_anime TEXT;
  gift_card_rarity TEXT;
  gift_card_image_url TEXT;
  gift_card_original_url TEXT;
  gift_card_fallback_urls TEXT[];
  gift_card_score NUMERIC;
  gift_card_shiki_id INTEGER;
  gift_card_character_id INTEGER;
  gift_card_stats_hp INTEGER;
  gift_card_stats_atk INTEGER;
  gift_card_stats_def INTEGER;
  gift_card_stats_spd INTEGER;
  gift_card_stats_luck INTEGER;
  gift_card_is_main_character BOOLEAN;
  gift_card_pack_id TEXT;
  gift_card_pack_name TEXT;
  gift_card_frame_modifier TEXT;
  gift_card_coating_modifier TEXT;
  gift_card_is_art_blacklisted BOOLEAN;
  gift_card_image_layers TEXT[];
  gift_card_art_position JSONB;
BEGIN
  INSERT INTO public.profiles (id, username, updated_at)
  VALUES (NEW.id, NEW.email, now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_coins (id, coins)
  VALUES (NEW.id, 10000)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_pity (id, bad_luck_streak)
  VALUES (NEW.id, 0)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_dust (id, dust)
  VALUES (NEW.id, 0)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_battle_progress (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_battle_decks (user_id, card_ids, leader_id, formation)
  VALUES (NEW.id, '{}', NULL, 'balance')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_ladder (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.account_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  IF NEW.raw_user_meta_data ? 'gift_card' THEN
    BEGIN
      IF jsonb_typeof(NEW.raw_user_meta_data -> 'gift_card') = 'string' THEN
        gift_card_payload := (NEW.raw_user_meta_data ->> 'gift_card')::jsonb;
      ELSE
        gift_card_payload := NEW.raw_user_meta_data -> 'gift_card';
      END IF;

      IF gift_card_payload IS NOT NULL AND gift_card_payload <> 'null'::jsonb THEN
        gift_card_name := COALESCE(gift_card_payload->>'name', '');
        gift_card_anime := COALESCE(gift_card_payload->>'anime', '');
        gift_card_rarity := COALESCE(gift_card_payload->>'rarity', 'common');
        gift_card_image_url := COALESCE(gift_card_payload->>'imageUrl', '');
        gift_card_original_url := COALESCE(gift_card_payload->>'originalUrl', gift_card_image_url);
        gift_card_fallback_urls := CASE
          WHEN gift_card_payload->'fallbackUrls' IS NULL THEN NULL
          ELSE ARRAY(SELECT jsonb_array_elements_text(gift_card_payload->'fallbackUrls'))
        END;
        gift_card_score := COALESCE((gift_card_payload->>'score')::numeric, 0);
        gift_card_shiki_id := COALESCE((gift_card_payload->>'shikiId')::integer, 0);
        gift_card_character_id := COALESCE((gift_card_payload->>'characterId')::integer, 0);
        gift_card_stats_hp := COALESCE((gift_card_payload->'stats'->>'hp')::integer, 0);
        gift_card_stats_atk := COALESCE((gift_card_payload->'stats'->>'atk')::integer, 0);
        gift_card_stats_def := COALESCE((gift_card_payload->'stats'->>'def')::integer, 0);
        gift_card_stats_spd := COALESCE((gift_card_payload->'stats'->>'spd')::integer, 0);
        gift_card_stats_luck := COALESCE((gift_card_payload->'stats'->>'luck')::integer, 0);
        gift_card_is_main_character := COALESCE((gift_card_payload->>'isMainCharacter')::boolean, false);
        gift_card_pack_id := gift_card_payload->>'packId';
        gift_card_pack_name := gift_card_payload->>'packName';
        gift_card_frame_modifier := gift_card_payload->>'frameModifier';
        gift_card_coating_modifier := gift_card_payload->>'coatingModifier';
        gift_card_is_art_blacklisted := COALESCE((gift_card_payload->>'isArtBlacklisted')::boolean, false);
        gift_card_image_layers := CASE
          WHEN gift_card_payload->'imageLayers' IS NULL THEN NULL
          ELSE ARRAY(SELECT jsonb_array_elements_text(gift_card_payload->'imageLayers'))
        END;
        gift_card_art_position := COALESCE(gift_card_payload->'artPosition', '{"x": 50, "y": 50}'::jsonb);

        IF gift_card_name <> '' AND gift_card_rarity <> '' THEN
          gift_card_unique_id := COALESCE(gift_card_payload->>'uniqueId', 'gift-' || NEW.id::text || '-' || floor(extract(epoch from now()) * 1000)::text);
          gift_card_serial_id := COALESCE(gift_card_payload->>'serialId', COALESCE(gift_card_payload->>'characterId', '0') || '-gift');

          IF EXISTS (
            SELECT 1
            FROM public.user_cards
            WHERE user_id = NEW.id
              AND unique_id = gift_card_unique_id
          ) THEN
            gift_card_unique_id := gift_card_unique_id || '-' || floor(extract(epoch from now()) * 1000)::text;
            gift_card_serial_id := gift_card_serial_id || '-G';
          END IF;

          INSERT INTO public.user_cards (
            user_id,
            unique_id,
            serial_id,
            name,
            anime,
            rarity,
            image_url,
            original_url,
            fallback_urls,
            score,
            shiki_id,
            character_id,
            stats_hp,
            stats_atk,
            stats_def,
            stats_spd,
            stats_luck,
            is_main_character,
            pack_id,
            pack_name,
            frame_modifier,
            coating_modifier,
            is_art_blacklisted,
            image_layers,
            art_position
          )
          VALUES (
            NEW.id,
            gift_card_unique_id,
            gift_card_serial_id,
            gift_card_name,
            gift_card_anime,
            gift_card_rarity,
            gift_card_image_url,
            gift_card_original_url,
            gift_card_fallback_urls,
            gift_card_score,
            gift_card_shiki_id,
            gift_card_character_id,
            gift_card_stats_hp,
            gift_card_stats_atk,
            gift_card_stats_def,
            gift_card_stats_spd,
            gift_card_stats_luck,
            gift_card_is_main_character,
            gift_card_pack_id,
            gift_card_pack_name,
            gift_card_frame_modifier,
            gift_card_coating_modifier,
            gift_card_is_art_blacklisted,
            gift_card_image_layers,
            gift_card_art_position
          )
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  SELECT id INTO referrer_id
  FROM public.profiles
  WHERE referral_code = lower(trim(NEW.raw_user_meta_data->>'referral_code'))
    AND id <> NEW.id;

  IF referrer_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id, bonus_given)
    VALUES (referrer_id, NEW.id, true)
    ON CONFLICT (referred_id) DO NOTHING;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    IF inserted_count = 1 THEN
      UPDATE public.profiles
      SET referred_by = referrer_id
      WHERE id = NEW.id;

      UPDATE public.user_coins
      SET coins = coins + bonus_amount, updated_at = now()
      WHERE id IN (NEW.id, referrer_id);

      INSERT INTO public.user_mail (user_id, sender, type, title, body, amount)
      VALUES (
        referrer_id,
        'system',
        'coins',
        'Реферальный бонус начислен',
        'Ваш друг зарегистрировался по реферальной ссылке. Вам начислено 2000 монет.',
        bonus_amount
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
