-- Telegram has an independent delivery cursor: website reads/notifications
-- must not swallow messages. Unlinking/deleting a subscription clears state.
CREATE TABLE IF NOT EXISTS public.telegram_episode_cursors (
  subscription_id UUID NOT NULL REFERENCES public.title_subscriptions(id) ON DELETE CASCADE,
  link_id UUID NOT NULL REFERENCES public.telegram_links(id) ON DELETE CASCADE,
  episode INTEGER NOT NULL CHECK (episode >= 0),
  PRIMARY KEY (subscription_id, link_id)
);
ALTER TABLE public.telegram_episode_cursors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_episode_cursors FROM anon, authenticated;
CREATE POLICY "Service role full access to telegram episode cursors"
  ON public.telegram_episode_cursors FOR ALL TO service_role
  USING (true) WITH CHECK (true);
