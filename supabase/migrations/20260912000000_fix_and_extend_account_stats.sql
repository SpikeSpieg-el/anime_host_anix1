-- Fix account statistics counters and add a separate watch-time metric.
--
-- total_time_ms = active time on the platform.
-- watch_time_ms = approximate active time on a player page while the tab is visible.
-- They are intentionally separate so the profile never presents browsing time as
-- watched time.

ALTER TABLE public.account_stats
  ADD COLUMN IF NOT EXISTS watch_time_ms BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.account_stats.watch_time_ms IS
  'Approximate active time spent on a watch/player page, in milliseconds';

CREATE OR REPLACE FUNCTION public.increment_account_stats(
  p_user_id UUID,
  p_total_sessions INTEGER DEFAULT 0,
  p_total_time_ms BIGINT DEFAULT 0,
  p_page_views INTEGER DEFAULT 0,
  p_watch_events INTEGER DEFAULT 0,
  p_watch_time_ms BIGINT DEFAULT 0,
  p_gacha_rolls INTEGER DEFAULT 0,
  p_battles_started INTEGER DEFAULT 0,
  p_bookmarks_added INTEGER DEFAULT 0,
  p_market_actions INTEGER DEFAULT 0,
  p_searches INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to update another user statistics';
  END IF;

  INSERT INTO public.account_stats (
    user_id,
    total_sessions,
    total_time_ms,
    page_views,
    watch_events,
    watch_time_ms,
    gacha_rolls,
    battles_started,
    bookmarks_added,
    market_actions,
    searches,
    last_updated_at
  )
  VALUES (
    p_user_id,
    GREATEST(COALESCE(p_total_sessions, 0), 0),
    GREATEST(COALESCE(p_total_time_ms, 0), 0),
    GREATEST(COALESCE(p_page_views, 0), 0),
    GREATEST(COALESCE(p_watch_events, 0), 0),
    GREATEST(COALESCE(p_watch_time_ms, 0), 0),
    GREATEST(COALESCE(p_gacha_rolls, 0), 0),
    GREATEST(COALESCE(p_battles_started, 0), 0),
    GREATEST(COALESCE(p_bookmarks_added, 0), 0),
    GREATEST(COALESCE(p_market_actions, 0), 0),
    GREATEST(COALESCE(p_searches, 0), 0),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_sessions = public.account_stats.total_sessions + EXCLUDED.total_sessions,
    total_time_ms = public.account_stats.total_time_ms + EXCLUDED.total_time_ms,
    page_views = public.account_stats.page_views + EXCLUDED.page_views,
    watch_events = public.account_stats.watch_events + EXCLUDED.watch_events,
    watch_time_ms = public.account_stats.watch_time_ms + EXCLUDED.watch_time_ms,
    gacha_rolls = public.account_stats.gacha_rolls + EXCLUDED.gacha_rolls,
    battles_started = public.account_stats.battles_started + EXCLUDED.battles_started,
    bookmarks_added = public.account_stats.bookmarks_added + EXCLUDED.bookmarks_added,
    market_actions = public.account_stats.market_actions + EXCLUDED.market_actions,
    searches = public.account_stats.searches + EXCLUDED.searches,
    avg_session_ms = CASE
      WHEN public.account_stats.total_sessions + EXCLUDED.total_sessions > 0
      THEN (public.account_stats.total_time_ms + EXCLUDED.total_time_ms)
        / (public.account_stats.total_sessions + EXCLUDED.total_sessions)
      ELSE 0
    END,
    last_updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_account_stats(
  UUID, INTEGER, BIGINT, INTEGER, INTEGER, BIGINT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_account_stats(
  UUID, INTEGER, BIGINT, INTEGER, INTEGER, BIGINT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER
) TO authenticated;
