-- Add referral codes and award both users once when a referred account is created.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  candidate TEXT;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      candidate := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE referral_code = candidate
      );
    END LOOP;
    NEW.referral_code := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_referral_code ON public.profiles;
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

UPDATE public.profiles
SET referral_code = lower(substr(md5(random()::text || clock_timestamp()::text), 1, 8))
WHERE referral_code IS NULL;

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  bonus_given BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

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
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
