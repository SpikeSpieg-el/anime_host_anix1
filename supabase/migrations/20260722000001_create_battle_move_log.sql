-- Battle move log for session-aware AI learning
-- Records individual card placements per round for ML training
CREATE TABLE IF NOT EXISTS battle_move_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  battle_id TEXT NOT NULL,
  dungeon_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  zone_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  card_name TEXT,
  card_role TEXT,
  card_rarity TEXT,
  is_secret BOOLEAN DEFAULT FALSE,
  is_player BOOLEAN NOT NULL,
  power_after_modifier REAL,
  zone_owner TEXT,
  battle_result TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_battle_move_log_user ON battle_move_log(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_move_log_battle ON battle_move_log(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_move_log_created ON battle_move_log(created_at DESC);

-- RLS
ALTER TABLE battle_move_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own battle moves" ON battle_move_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own battle moves" ON battle_move_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role bypasses RLS (used by API routes)
