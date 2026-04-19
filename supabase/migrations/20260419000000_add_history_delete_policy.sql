-- Add DELETE policy for watch_history table
-- This fixes the issue where users cannot delete their own history items

CREATE POLICY "Users can delete own history" ON watch_history
  FOR DELETE USING (auth.uid() = user_id);
