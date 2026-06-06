-- Create table for AI adaptive learning statistics
CREATE TABLE IF NOT EXISTS ai_learning_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_battles INTEGER DEFAULT 0,
  last_battle_date TIMESTAMP WITH TIME ZONE,
  favorite_cards JSONB DEFAULT '[]'::jsonb,
  preferred_roles JSONB DEFAULT '{"vanguard": 0, "guard": 0, "trickster": 0}'::jsonb,
  preferred_rarities JSONB DEFAULT '{}'::jsonb,
  avg_provision_cost DECIMAL DEFAULT 0,
  aggressive_rating DECIMAL DEFAULT 0.5,
  defensive_rating DECIMAL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ai_learning_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own stats
CREATE POLICY "Users can read own AI stats"
  ON ai_learning_stats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own stats
CREATE POLICY "Users can update own AI stats"
  ON ai_learning_stats
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own stats
CREATE POLICY "Users can insert own AI stats"
  ON ai_learning_stats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can read all stats (for admin)
CREATE POLICY "Service role can read all AI stats"
  ON ai_learning_stats
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_learning_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER ai_learning_stats_updated_at
  BEFORE UPDATE ON ai_learning_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_learning_stats_updated_at();

-- Function to create AI stats for new users
CREATE OR REPLACE FUNCTION create_ai_learning_stats_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ai_learning_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create AI stats on user creation
CREATE TRIGGER on_user_created_create_ai_stats
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_ai_learning_stats_for_user();
