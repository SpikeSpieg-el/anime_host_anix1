-- Create PvP Ladder System
-- This migration creates tables for PvP matchmaking and ranking

-- User Ladder Table (MMR/Ranking)
CREATE TABLE IF NOT EXISTS user_ladder (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mmr INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  rank_tier TEXT NOT NULL DEFAULT 'bronze',
  highest_mmr INTEGER NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PvP Battle Logs Table
CREATE TABLE IF NOT EXISTS pvp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player1_mmr_before INTEGER NOT NULL,
  player2_mmr_before INTEGER NOT NULL,
  player1_mmr_after INTEGER NOT NULL,
  player2_mmr_after INTEGER NOT NULL,
  player1_deck JSONB,
  player2_deck JSONB,
  battle_data JSONB,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_ladder_mmr ON user_ladder(mmr DESC);
CREATE INDEX IF NOT EXISTS idx_user_ladder_rank_tier ON user_ladder(rank_tier);
CREATE INDEX IF NOT EXISTS idx_pvp_logs_player1 ON pvp_logs(player1_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pvp_logs_player2 ON pvp_logs(player2_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pvp_logs_created_at ON pvp_logs(created_at DESC);

-- Row Level Security
ALTER TABLE user_ladder ENABLE ROW LEVEL SECURITY;
ALTER TABLE pvp_logs ENABLE ROW LEVEL SECURITY;

-- Policies for user_ladder
CREATE POLICY "Users can view all ladder entries"
  ON user_ladder FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own ladder entry"
  ON user_ladder FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ladder entry"
  ON user_ladder FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policies for pvp_logs
CREATE POLICY "Users can view their own PvP logs"
  ON pvp_logs FOR SELECT
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Service role can insert PvP logs"
  ON pvp_logs FOR INSERT
  WITH CHECK (true);

-- Function to auto-create ladder entry for new users
CREATE OR REPLACE FUNCTION create_user_ladder_entry()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_ladder (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create ladder entry on user creation
DROP TRIGGER IF EXISTS on_auth_user_created_ladder ON auth.users;
CREATE TRIGGER on_auth_user_created_ladder
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_ladder_entry();

-- Function to calculate rank tier based on MMR
CREATE OR REPLACE FUNCTION calculate_rank_tier(mmr_value INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF mmr_value >= 2400 THEN
    RETURN 'grandmaster';
  ELSIF mmr_value >= 2200 THEN
    RETURN 'master';
  ELSIF mmr_value >= 2000 THEN
    RETURN 'diamond';
  ELSIF mmr_value >= 1800 THEN
    RETURN 'platinum';
  ELSIF mmr_value >= 1600 THEN
    RETURN 'gold';
  ELSIF mmr_value >= 1400 THEN
    RETURN 'silver';
  ELSE
    RETURN 'bronze';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update MMR after a PvP match (ELO-based)
CREATE OR REPLACE FUNCTION update_pvp_mmr(
  p_winner_id UUID,
  p_loser_id UUID,
  p_winner_mmr INTEGER,
  p_loser_mmr INTEGER
)
RETURNS TABLE(winner_new_mmr INTEGER, loser_new_mmr INTEGER) AS $$
DECLARE
  k_factor INTEGER := 32;
  expected_winner NUMERIC;
  expected_loser NUMERIC;
  winner_change INTEGER;
  loser_change INTEGER;
  new_winner_mmr INTEGER;
  new_loser_mmr INTEGER;
  new_winner_tier TEXT;
  new_loser_tier TEXT;
BEGIN
  -- Calculate expected scores using ELO formula
  expected_winner := 1.0 / (1.0 + POWER(10.0, (p_loser_mmr - p_winner_mmr)::NUMERIC / 400.0));
  expected_loser := 1.0 / (1.0 + POWER(10.0, (p_winner_mmr - p_loser_mmr)::NUMERIC / 400.0));
  
  -- Calculate MMR changes
  winner_change := ROUND(k_factor * (1.0 - expected_winner));
  loser_change := ROUND(k_factor * (0.0 - expected_loser));
  
  -- Apply changes (minimum loss is -5, minimum gain is +5)
  new_winner_mmr := p_winner_mmr + GREATEST(winner_change, 5);
  new_loser_mmr := GREATEST(p_loser_mmr + loser_change, 800); -- Floor at 800 MMR
  
  -- Calculate new tiers
  new_winner_tier := calculate_rank_tier(new_winner_mmr);
  new_loser_tier := calculate_rank_tier(new_loser_mmr);
  
  -- Update winner
  UPDATE user_ladder
  SET 
    mmr = new_winner_mmr,
    wins = wins + 1,
    rank_tier = new_winner_tier,
    highest_mmr = GREATEST(highest_mmr, new_winner_mmr),
    updated_at = NOW()
  WHERE user_id = p_winner_id;
  
  -- Update loser
  UPDATE user_ladder
  SET 
    mmr = new_loser_mmr,
    losses = losses + 1,
    rank_tier = new_loser_tier,
    updated_at = NOW()
  WHERE user_id = p_loser_id;
  
  RETURN QUERY SELECT new_winner_mmr, new_loser_mmr;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create initial ladder entries for existing users
INSERT INTO user_ladder (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
