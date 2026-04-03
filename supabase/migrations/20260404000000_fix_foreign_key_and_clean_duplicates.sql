-- Migration: Fix foreign key constraint and clean up duplicate dungeons
-- Run this in Supabase SQL Editor

-- ==========================================
-- 1. DROP AND RECREATE FOREIGN KEY WITH ON DELETE CASCADE
-- ==========================================

-- First, drop the existing foreign key constraint
ALTER TABLE public.battle_logs DROP CONSTRAINT IF EXISTS battle_logs_dungeon_id_fkey;

-- Recreate the foreign key with ON DELETE CASCADE
ALTER TABLE public.battle_logs 
ADD CONSTRAINT battle_logs_dungeon_id_fkey 
FOREIGN KEY (dungeon_id) REFERENCES public.battle_dungeons(id) ON DELETE CASCADE;

-- ==========================================
-- 2. IDENTIFY AND CLEAN UP DUPLICATE "Тёмный Лес" DUNGEONS
-- ==========================================

-- Update battle logs to point to the original dungeon
UPDATE public.battle_logs 
SET dungeon_id = (
  SELECT id FROM (
    SELECT 
      id, 
      ROW_NUMBER() OVER (PARTITION BY name_ru ORDER BY created_at) as rn
    FROM public.battle_dungeons 
    WHERE name_ru = 'Тёмный Лес'
  ) original 
  WHERE rn = 1
  LIMIT 1
)
WHERE dungeon_id IN (
  SELECT id FROM (
    SELECT 
      id, 
      ROW_NUMBER() OVER (PARTITION BY name_ru ORDER BY created_at) as rn
    FROM public.battle_dungeons 
    WHERE name_ru = 'Тёмный Лес'
  ) duplicates 
  WHERE rn > 1
);

-- Delete the duplicate dungeons (keep only the oldest one)
DELETE FROM public.battle_dungeons 
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id, 
      ROW_NUMBER() OVER (PARTITION BY name_ru ORDER BY created_at) as rn
    FROM public.battle_dungeons 
    WHERE name_ru = 'Тёмный Лес'
  ) duplicates 
  WHERE rn > 1
);

-- ==========================================
-- 3. VERIFICATION
-- ==========================================

-- Show remaining "Тёмный Лес" dungeons (should be only 1)
SELECT 
  id, 
  name, 
  name_ru, 
  created_at,
  'Remaining Тёмный Лес dungeons (should be 1):' as info
FROM public.battle_dungeons 
WHERE name_ru = 'Тёмный Лес'
ORDER BY created_at;

-- Show any orphaned battle logs (should be 0)
SELECT 
  COUNT(*) as orphaned_logs_count,
  'Orphaned battle logs (should be 0):' as info
FROM public.battle_logs bl
LEFT JOIN public.battle_dungeons bd ON bl.dungeon_id = bd.id
WHERE bl.dungeon_id IS NOT NULL AND bd.id IS NULL;

-- ==========================================
-- 4. CLEAN UP OTHER POTENTIAL DUPLICATES (OPTIONAL)
-- ==========================================

-- Uncomment this section if you want to clean up other potential duplicates
-- This will keep only the oldest version of each dungeon with the same name_ru

/*
WITH all_duplicates AS (
  SELECT 
    id, 
    name_ru, 
    created_at,
    ROW_NUMBER() OVER (PARTITION BY name_ru ORDER BY created_at) as rn
  FROM public.battle_dungeons
),
-- Get all dungeon IDs to keep (oldest of each name_ru)
dungeons_to_keep AS (
  SELECT id FROM all_duplicates WHERE rn = 1
),
-- Get all dungeon IDs to delete (duplicates)
dungeons_to_delete AS (
  SELECT id FROM all_duplicates WHERE rn > 1
)

-- Update battle logs to point to the original dungeons
UPDATE public.battle_logs 
SET dungeon_id = (
  SELECT dk.id 
  FROM dungeons_to_keep dk
  JOIN all_duplicates ad ON dk.id = ad.id
  WHERE ad.name_ru = (
    SELECT ad2.name_ru 
    FROM all_duplicates ad2 
    WHERE ad2.id = public.battle_logs.dungeon_id
  )
  LIMIT 1
)
WHERE dungeon_id IN (SELECT id FROM dungeons_to_delete);

-- Delete duplicate dungeons
DELETE FROM public.battle_dungeons 
WHERE id IN (SELECT id FROM dungeons_to_delete);
*/

-- ==========================================
-- COMMENTS
-- ==========================================
COMMENT ON COLUMN public.battle_logs.dungeon_id IS 'References battle_dungeons(id) with ON DELETE CASCADE to prevent orphaned records';
