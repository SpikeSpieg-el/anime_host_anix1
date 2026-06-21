-- Battle sessions table for anti-replay protection
-- Tracks active battles with unique tokens to prevent reward farming
CREATE TABLE IF NOT EXISTS battle_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dungeon_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'expired'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Index for quick lookup by user
CREATE INDEX IF NOT EXISTS idx_battle_sessions_user_id ON battle_sessions(user_id);
-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_battle_sessions_token ON battle_sessions(token);

-- Enable RLS
ALTER TABLE battle_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own sessions
CREATE POLICY "Users can view own battle sessions" ON battle_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Auto-expire sessions older than 30 minutes
-- (handled in application logic, but this is a safety net)
CREATE OR REPLACE FUNCTION cleanup_expired_battle_sessions()
RETURNS void AS $$
BEGIN
  UPDATE battle_sessions 
  SET status = 'expired' 
  WHERE status = 'active' 
  AND created_at < now() - interval '30 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
