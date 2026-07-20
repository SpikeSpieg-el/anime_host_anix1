CREATE TABLE IF NOT EXISTS public.ai_player_dungeon_profiles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dungeon_id TEXT NOT NULL,
  battles INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  consecutive_wins INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dungeon_id)
);

CREATE TABLE IF NOT EXISTS public.ai_dungeon_learning (
  dungeon_id TEXT PRIMARY KEY,
  battles INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  total_turns INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_player_dungeon_profiles_user_id ON public.ai_player_dungeon_profiles(user_id);

ALTER TABLE public.ai_player_dungeon_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_dungeon_learning ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_ai_battle_learning(
  p_user_id UUID,
  p_dungeon_id TEXT,
  p_result TEXT,
  p_turns INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_result NOT IN ('win', 'loss') OR length(trim(p_dungeon_id)) = 0 THEN
    RAISE EXCEPTION 'Invalid AI learning result';
  END IF;

  INSERT INTO ai_player_dungeon_profiles (user_id, dungeon_id, battles, wins, losses, consecutive_wins)
  VALUES (
    p_user_id,
    p_dungeon_id,
    1,
    CASE WHEN p_result = 'win' THEN 1 ELSE 0 END,
    CASE WHEN p_result = 'loss' THEN 1 ELSE 0 END,
    CASE WHEN p_result = 'win' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, dungeon_id) DO UPDATE SET
    battles = ai_player_dungeon_profiles.battles + 1,
    wins = ai_player_dungeon_profiles.wins + CASE WHEN p_result = 'win' THEN 1 ELSE 0 END,
    losses = ai_player_dungeon_profiles.losses + CASE WHEN p_result = 'loss' THEN 1 ELSE 0 END,
    consecutive_wins = CASE WHEN p_result = 'win' THEN ai_player_dungeon_profiles.consecutive_wins + 1 ELSE 0 END,
    updated_at = now();

  INSERT INTO ai_dungeon_learning (dungeon_id, battles, wins, losses, total_turns)
  VALUES (
    p_dungeon_id,
    1,
    CASE WHEN p_result = 'win' THEN 1 ELSE 0 END,
    CASE WHEN p_result = 'loss' THEN 1 ELSE 0 END,
    GREATEST(COALESCE(p_turns, 0), 0)
  )
  ON CONFLICT (dungeon_id) DO UPDATE SET
    battles = ai_dungeon_learning.battles + 1,
    wins = ai_dungeon_learning.wins + CASE WHEN p_result = 'win' THEN 1 ELSE 0 END,
    losses = ai_dungeon_learning.losses + CASE WHEN p_result = 'loss' THEN 1 ELSE 0 END,
    total_turns = ai_dungeon_learning.total_turns + GREATEST(COALESCE(p_turns, 0), 0),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_ai_battle_learning(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_ai_battle_learning(UUID, TEXT, TEXT, INTEGER) TO service_role;
