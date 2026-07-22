-- Add scale, position, and opacity controls to battle_backgrounds
ALTER TABLE battle_backgrounds
  ADD COLUMN IF NOT EXISTS scale FLOAT NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS position_x FLOAT NOT NULL DEFAULT 50.0,
  ADD COLUMN IF NOT EXISTS position_y FLOAT NOT NULL DEFAULT 50.0,
  ADD COLUMN IF NOT EXISTS opacity FLOAT NOT NULL DEFAULT 0.35;
