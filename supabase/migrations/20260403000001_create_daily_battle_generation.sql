-- Migration: Create function for automatic daily battle generation
-- Run this in Supabase SQL Editor

-- Function to generate daily battles for the next 7 days
CREATE OR REPLACE FUNCTION public.generate_daily_battles()
RETURNS void AS $$
DECLARE
  today_date DATE;
  i INTEGER;
BEGIN
  today_date := CURRENT_DATE;
  
  -- Generate daily battles for the next 7 days
  FOR i IN 0..6 LOOP
    -- Skip if already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.battle_daily 
      WHERE date = today_date + i
    ) THEN
      -- Randomly select 1-2 enemies based on day pattern
      INSERT INTO public.battle_daily (date, enemy_ids, coins_reward, dust_reward, xp_reward, energy_cost, is_active)
      SELECT 
        today_date + i,
        ARRAY(
          -- Mix of elite and boss enemies based on day
          (SELECT id FROM public.battle_enemies 
           WHERE tier = CASE 
             WHEN EXTRACT(DOW FROM today_date + i) IN (0, 6) THEN 'boss'  -- Sunday, Saturday
             WHEN EXTRACT(DOW FROM today_date + i) IN (1, 2, 3, 4, 5) THEN 'elite'  -- Monday-Friday
             ELSE 'elite'
           END
           ORDER BY RANDOM() 
           LIMIT CASE 
             WHEN EXTRACT(DOW FROM today_date + i) IN (0, 6) THEN 2  -- Weekend: 2 bosses
             ELSE 2  -- Weekdays: 2 elites
           END
          )
        ),
        -- Higher rewards on weekends
        CASE 
          WHEN EXTRACT(DOW FROM today_date + i) IN (0, 6) THEN 300  -- Weekend bonus
          ELSE 200
        END,
        CASE 
          WHEN EXTRACT(DOW FROM today_date + i) IN (0, 6) THEN 75   -- Weekend bonus
          ELSE 50
        END,
        CASE 
          WHEN EXTRACT(DOW FROM today_date + i) IN (0, 6) THEN 150  -- Weekend bonus
          ELSE 100
        END,
        1,
        true
      ON CONFLICT (date) DO NOTHING;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically call this function daily
-- This would require setting up pg_cron or using an external scheduler
COMMENT ON FUNCTION public.generate_daily_battles() IS 'Generates daily battles for the next 7 days with random enemies and tier-based rewards';
