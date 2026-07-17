-- Migration: Create user_banner_pulls table for tracking pulls per banner (for guaranteed card pity)
-- Tracks how many pulls a user has done on each banner

CREATE TABLE IF NOT EXISTS public.user_banner_pulls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  banner_id UUID NOT NULL REFERENCES public.banners(id) ON DELETE CASCADE,
  pull_count INTEGER NOT NULL DEFAULT 0,
  guaranteed_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  last_pull_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, banner_id)
);

CREATE INDEX IF NOT EXISTS idx_user_banner_pulls_user ON public.user_banner_pulls(user_id);
CREATE INDEX IF NOT EXISTS idx_user_banner_pulls_banner ON public.user_banner_pulls(banner_id);

ALTER TABLE public.user_banner_pulls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own banner pulls" ON public.user_banner_pulls;
CREATE POLICY "Users can view own banner pulls"
  ON public.user_banner_pulls
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_banner_pulls IS 'Tracks user pulls per banner for guaranteed card pity system';
