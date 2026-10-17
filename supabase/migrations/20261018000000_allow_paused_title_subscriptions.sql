-- Turning off both notification channels pauses a title subscription; it does
-- not remove the title from the user's list. Explicit deletion stays separate.
ALTER TABLE public.title_subscriptions
  DROP CONSTRAINT IF EXISTS title_subscriptions_has_channel;
