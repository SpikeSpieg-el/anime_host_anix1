-- Add is_archived field to watch_history table
ALTER TABLE watch_history ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Add index for better performance on archived history
CREATE INDEX IF NOT EXISTS idx_watch_history_user_archived ON watch_history(user_id, is_archived);

-- Create policy for users to update their own history archive status
CREATE POLICY "Users can update own history archive" ON watch_history
  FOR UPDATE USING (auth.uid() = user_id);
