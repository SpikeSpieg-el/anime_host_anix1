CREATE TABLE IF NOT EXISTS public.gift_card_tokens (
  token TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ
);

ALTER TABLE public.gift_card_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.resolve_gift_card_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token_value TEXT;
  card_payload JSONB;
BEGIN
  token_value := NEW.raw_user_meta_data ->> 'gift_card';

  IF token_value IS NOT NULL AND token_value !~ '^\{'
     AND token_value ~ '^[A-Za-z0-9]{32}$' THEN
    SELECT payload INTO card_payload
    FROM public.gift_card_tokens
    WHERE token = token_value
      AND claimed_at IS NULL
      AND created_at > now() - INTERVAL '30 days'
    FOR UPDATE;

    IF card_payload IS NOT NULL THEN
      NEW.raw_user_meta_data := jsonb_set(
        NEW.raw_user_meta_data,
        '{gift_card}',
        to_jsonb(card_payload::text)
      );

      UPDATE public.gift_card_tokens
      SET claimed_at = now()
      WHERE token = token_value;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_gift_card_token_before_signup ON auth.users;
CREATE TRIGGER resolve_gift_card_token_before_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_gift_card_token();
