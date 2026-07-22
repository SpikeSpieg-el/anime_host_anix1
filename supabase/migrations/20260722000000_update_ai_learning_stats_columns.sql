-- Alter table to add missing AI adaptive learning columns
ALTER TABLE ai_learning_stats 
ADD COLUMN IF NOT EXISTS role_preference JSONB DEFAULT '{"vanguard": 0.33, "guard": 0.33, "trickster": 0.34}'::jsonb,
ADD COLUMN IF NOT EXISTS counter_role_priority JSONB DEFAULT '{"vanguard": 0.33, "guard": 0.33, "trickster": 0.34}'::jsonb,
ADD COLUMN IF NOT EXISTS bluff_tendency DECIMAL DEFAULT 0.5;
