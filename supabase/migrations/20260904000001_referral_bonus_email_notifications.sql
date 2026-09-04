ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS email_notified_at TIMESTAMPTZ;

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
