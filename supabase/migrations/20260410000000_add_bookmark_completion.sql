-- Add is_completed field to bookmarks table
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

-- Add index for better performance on completed bookmarks
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_completed ON bookmarks(user_id, is_completed);

-- Create policy for users to update their own bookmark completion status
CREATE POLICY "Users can update own bookmark completion" ON bookmarks
  FOR UPDATE USING (auth.uid() = user_id);
