-- Migration: Fix Daily Battle Status
-- Description: Fixes incorrect daily battle completion status by resetting counters for users who have not actually won today's daily battle

-- Update user progress to reset daily battles for users who haven't actually completed today's daily battle
UPDATE public.user_battle_progress ubp
SET daily_battles_today = 0
WHERE ubp.daily_battles_today > 0
AND NOT EXISTS (
  SELECT 1 FROM public.battle_logs bl
  WHERE bl.user_id::text = ubp.user_id::text
  AND bl.dungeon_id::text = 'daily-' || CURRENT_DATE::text
  AND bl.result = 'win'
);

-- Also reset last_daily_reset if it's incorrectly set
UPDATE public.user_battle_progress ubp
SET last_daily_reset = CURRENT_DATE - INTERVAL '1 day'
WHERE ubp.last_daily_reset = CURRENT_DATE
AND NOT EXISTS (
  SELECT 1 FROM public.battle_logs bl
  WHERE bl.user_id::text = ubp.user_id::text
  AND bl.dungeon_id::text = 'daily-' || CURRENT_DATE::text
  AND bl.result = 'win'
);
