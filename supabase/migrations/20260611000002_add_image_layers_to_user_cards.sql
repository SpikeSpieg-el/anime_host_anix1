-- Add image_layers column to user_cards table
ALTER TABLE user_cards ADD COLUMN IF NOT EXISTS image_layers text[] DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN user_cards.image_layers IS 'PNG layers for 3D parallax effect [background, character, foreground]';
