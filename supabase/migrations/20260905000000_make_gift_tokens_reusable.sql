CREATE TABLE IF NOT EXISTS public.gift_card_claims (
  token TEXT NOT NULL REFERENCES public.gift_card_tokens(token) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_unique_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (token, user_id)
);

ALTER TABLE public.gift_card_claims ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gift_card_claims_user_card
  ON public.gift_card_claims(user_id, card_unique_id);

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

  IF token_value IS NOT NULL
     AND token_value !~ '^\{'
     AND token_value ~ '^[A-Za-z0-9]{32}$' THEN
    SELECT payload INTO card_payload
    FROM public.gift_card_tokens
    WHERE token = token_value
      AND created_at > now() - INTERVAL '30 days';

    IF card_payload IS NOT NULL THEN
      NEW.raw_user_meta_data := jsonb_set(
        NEW.raw_user_meta_data,
        '{gift_card}',
        to_jsonb(card_payload::text)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
