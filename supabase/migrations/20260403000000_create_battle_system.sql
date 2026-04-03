-- Migration: Create PVE Battle System
-- Run this in Supabase SQL Editor

-- ==========================================
-- 1. ENEMY TEMPLATES (pre-defined enemies)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.battle_enemies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ru TEXT NOT NULL,
  anime TEXT,
  image_url TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  tier TEXT NOT NULL DEFAULT 'normal' CHECK (tier IN ('normal', 'elite', 'boss', 'legendary')),
  stats_hp INTEGER NOT NULL DEFAULT 100,
  stats_atk INTEGER NOT NULL DEFAULT 20,
  stats_def INTEGER NOT NULL DEFAULT 15,
  stats_spd INTEGER NOT NULL DEFAULT 10,
  stats_luck INTEGER NOT NULL DEFAULT 5,
  special_ability TEXT,
  special_desc TEXT,
  coins_reward INTEGER NOT NULL DEFAULT 50,
  dust_reward INTEGER NOT NULL DEFAULT 0,
  xp_reward INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. DUNGEONS (battle stages/campaigns)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.battle_dungeons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_ru TEXT NOT NULL,
  description TEXT,
  theme TEXT NOT NULL DEFAULT 'dark_forest' CHECK (theme IN ('dark_forest', 'volcano', 'ocean', 'sky_castle', 'demon_realm', 'tournament', 'daily', 'boss_raid')),
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 100),
  required_level INTEGER NOT NULL DEFAULT 1,
  enemy_ids UUID[] NOT NULL DEFAULT '{}',
  coins_reward_base INTEGER NOT NULL DEFAULT 100,
  dust_reward_base INTEGER NOT NULL DEFAULT 20,
  xp_reward_base INTEGER NOT NULL DEFAULT 50,
  energy_cost INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 3. USER BATTLE PROGRESS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_battle_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  xp_to_next INTEGER NOT NULL DEFAULT 100,
  current_stamina INTEGER NOT NULL DEFAULT 10,
  max_stamina INTEGER NOT NULL DEFAULT 10,
  last_stamina_refill TIMESTAMPTZ DEFAULT NOW(),
  dungeons_cleared TEXT[] DEFAULT '{}',
  total_battles INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_losses INTEGER NOT NULL DEFAULT 0,
  highest_dungeon_cleared INTEGER DEFAULT 0,
  daily_battles_today INTEGER NOT NULL DEFAULT 0,
  last_daily_reset DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ==========================================
-- 4. BATTLE LOGS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.battle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dungeon_id UUID REFERENCES public.battle_dungeons(id),
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  player_cards TEXT[] NOT NULL DEFAULT '{}',
  enemy_ids UUID[] NOT NULL DEFAULT '{}',
  coins_earned INTEGER NOT NULL DEFAULT 0,
  dust_earned INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  battle_turns INTEGER NOT NULL DEFAULT 0,
  player_hp_remaining INTEGER DEFAULT 0,
  enemy_hp_remaining INTEGER DEFAULT 0,
  battle_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 5. DAILY BATTLES (auto-reset)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.battle_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE DEFAULT CURRENT_DATE,
  enemy_ids UUID[] NOT NULL DEFAULT '{}',
  coins_reward INTEGER NOT NULL DEFAULT 200,
  dust_reward INTEGER NOT NULL DEFAULT 50,
  xp_reward INTEGER NOT NULL DEFAULT 100,
  energy_cost INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_battle_enemies_tier ON public.battle_enemies(tier);
CREATE INDEX IF NOT EXISTS idx_battle_enemies_level ON public.battle_enemies(level);
CREATE INDEX IF NOT EXISTS idx_battle_dungeons_difficulty ON public.battle_dungeons(difficulty);
CREATE INDEX IF NOT EXISTS idx_battle_dungeons_theme ON public.battle_dungeons(theme);
CREATE INDEX IF NOT EXISTS idx_user_battle_progress_user_id ON public.user_battle_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_logs_user_id ON public.battle_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_logs_created_at ON public.battle_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_battle_daily_date ON public.battle_daily(date);

-- ==========================================
-- RLS (Row Level Security)
-- ==========================================
ALTER TABLE public.battle_enemies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_dungeons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_battle_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_daily ENABLE ROW LEVEL SECURITY;

-- Enemies: everyone can read, only service role can write
DROP POLICY IF EXISTS "Anyone can view active enemies" ON public.battle_enemies;
CREATE POLICY "Anyone can view active enemies" ON public.battle_enemies
  FOR SELECT USING (is_active = true);

-- Dungeons: everyone can read active dungeons
DROP POLICY IF EXISTS "Anyone can view active dungeons" ON public.battle_dungeons;
CREATE POLICY "Anyone can view active dungeons" ON public.battle_dungeons
  FOR SELECT USING (is_active = true);

-- User progress: users can read/write their own
DROP POLICY IF EXISTS "Users can view own progress" ON public.user_battle_progress;
CREATE POLICY "Users can view own progress" ON public.user_battle_progress
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_battle_progress;
CREATE POLICY "Users can insert own progress" ON public.user_battle_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own progress" ON public.user_battle_progress;
CREATE POLICY "Users can update own progress" ON public.user_battle_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Battle logs: users can read/write their own
DROP POLICY IF EXISTS "Users can view own logs" ON public.battle_logs;
CREATE POLICY "Users can view own logs" ON public.battle_logs
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own logs" ON public.battle_logs;
CREATE POLICY "Users can insert own logs" ON public.battle_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Daily battles: anyone can read today's
DROP POLICY IF EXISTS "Anyone can view daily battles" ON public.battle_daily;
CREATE POLICY "Anyone can view daily battles" ON public.battle_daily
  FOR SELECT USING (is_active = true);

-- ==========================================
-- FUNCTIONS
-- ==========================================

-- Create user battle progress on signup
CREATE OR REPLACE FUNCTION public.create_user_battle_progress_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_battle_progress (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_create_battle_progress ON auth.users;
CREATE TRIGGER on_auth_user_created_create_battle_progress
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_battle_progress_on_signup();

-- Create battle progress for existing users
INSERT INTO public.user_battle_progress (user_id)
SELECT u.id FROM auth.users u
LEFT JOIN public.user_battle_progress ubp ON u.id = ubp.user_id
WHERE ubp.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ==========================================
-- SEED: DEFAULT ENEMIES
-- ==========================================
INSERT INTO public.battle_enemies (name, name_ru, anime, image_url, level, tier, stats_hp, stats_atk, stats_def, stats_spd, stats_luck, special_ability, special_desc, coins_reward, dust_reward, xp_reward) VALUES
-- Normal enemies (difficulty 1-5)
('Shadow Clone', 'Теневой Клон', 'Наруто', 'https://shikimori.one/system/characters/original/4068.jpg', 1, 'normal', 80, 15, 10, 12, 3, 'shadow_strike', 'Атака тенью: +20% урон', 30, 0, 10),
('Hollow Soldier', 'Пустой Солдат', 'Блич', NULL, 1, 'normal', 100, 12, 18, 8, 2, 'iron_wall', 'Железная стена: +30% защита на 2 хода', 35, 0, 12),
('Titan Shifter', 'Титан-перевертыш', 'Атака Титанов', 'https://shikimori.one/system/characters/original/4068.jpg', 2, 'normal', 150, 20, 15, 10, 5, 'roar', 'Рёв титана: оглушает 1 врага на 1 ход', 50, 5, 20),
('Cursed Spirit', 'Проклятый Дух', 'Магическая Битва', NULL, 2, 'normal', 120, 25, 8, 15, 8, 'domain_expansion', 'Расширение территории: массовый урон', 55, 5, 22),
('Demon Soldier', 'Демон-солдат', 'Истребитель Демонов', NULL, 3, 'normal', 180, 22, 20, 14, 6, 'blood_art', 'Кровавое искусство: вампиризм', 70, 10, 30),

-- Elite enemies (difficulty 3-7)
('Akuma', 'Акума', 'Синий Замок', NULL, 4, 'elite', 300, 35, 25, 20, 10, 'regeneration', 'Регенерация: восстановление HP каждый ход', 120, 25, 60),
('Chimera Ant', 'Муравей-химера', 'Hunter x Hunter', NULL, 5, 'elite', 400, 45, 30, 25, 15, 'rage_mode', 'Режим ярости: ATK +50% при HP < 30%', 150, 30, 75),
('Espada', 'Эспада', 'Блич', NULL, 6, 'elite', 500, 55, 35, 30, 12, 'cero', 'Серо: массовая атака по всем картам', 200, 40, 100),
('Kage', 'Каге', 'Наруто', NULL, 7, 'elite', 600, 60, 40, 35, 20, 'shadow_clones', 'Теневые клоны: призывает 2 клона', 250, 50, 120),

-- Boss enemies (difficulty 5-10)
('Sosuke Aizen', 'Соске Айзен', 'Блич', 'https://shikimori.one/system/characters/original/2379.jpg', 8, 'boss', 1200, 80, 50, 45, 25, 'kyoka_suigetsu', 'Полная гипноз: все атаки промахиваются 1 ход', 500, 100, 300),
('Madara Uchiha', 'Мадара Учиха', 'Наруто', 'https://shikimori.one/system/characters/original/447.jpg', 9, 'boss', 1500, 95, 60, 50, 30, 'susano_o', 'Сусано''о: неуязвимость на 2 хода', 700, 150, 400),
('Satoru Gojo', 'Сатору Годзё', 'Магическая Битва', 'https://shikimori.one/system/characters/original/136565.jpg', 10, 'boss', 2000, 110, 70, 60, 40, 'infinite_void', 'Бесконечная пустота: все враги пропускают 1 ход', 1000, 200, 600),

-- Legendary enemies
('Demon King', 'Король Демонов', 'Оригинальный', NULL, 15, 'legendary', 3000, 150, 100, 80, 50, 'apocalypse', 'Апокалипсис: урон всем + снижение характеристик', 2000, 500, 1000),
('Dragon God', 'Бог Драконов', 'Оригинальный', NULL, 20, 'legendary', 5000, 200, 150, 100, 60, 'divine_judgment', 'Божественный суд: одномоментный мощный удар', 5000, 1000, 2000);

-- ==========================================
-- SEED: DEFAULT DUNGEONS
-- ==========================================
-- We'll insert these with the actual enemy UUIDs after they're created
-- For now, dungeons reference enemies by a pattern

INSERT INTO public.battle_dungeons (name, name_ru, description, theme, difficulty, required_level, coins_reward_base, dust_reward_base, xp_reward_base, energy_cost, sort_order) VALUES
('Dark Forest', 'Тёмный Лес', 'Тёмный лес полон теневых существ. Новичкам стоит начать отсюда.', 'dark_forest', 1, 1, 80, 10, 40, 1, 1),
('Volcanic Cave', 'Вулканическая Пещера', 'Раскалённая лава и демоны ждут внутри...', 'volcano', 3, 3, 150, 25, 80, 1, 2),
('Ocean Depths', 'Глубины Океана', 'Подводные чудовища скрываются в темноте глубин.', 'ocean', 5, 5, 250, 40, 120, 2, 3),
('Sky Castle', 'Небесный Замок', 'Парящий замок где правят элитные воины.', 'sky_castle', 7, 7, 400, 60, 200, 2, 4),
('Demon Realm', 'Мир Демонов', 'Врата в мир демонов. Здесь начинается настоящий ад.', 'demon_realm', 10, 10, 600, 100, 350, 3, 5),
('Grand Tournament', 'Великий Турнир', 'Лучшие воины собираются на великий турнир!', 'tournament', 15, 15, 1000, 200, 500, 3, 6);

-- ==========================================
-- SEED: DAILY BATTLES
-- ==========================================
-- Insert sample daily battles for the next few days
-- Today's daily battle
INSERT INTO public.battle_daily (date, enemy_ids, coins_reward, dust_reward, xp_reward, energy_cost, is_active)
SELECT CURRENT_DATE, 
       ARRAY[enemy1.id, enemy2.id],
       200, 50, 100, 1, true
FROM (SELECT id FROM public.battle_enemies WHERE tier = 'elite' ORDER BY RANDOM() LIMIT 1) enemy1,
     (SELECT id FROM public.battle_enemies WHERE tier = 'elite' ORDER BY RANDOM() LIMIT 1) enemy2;

-- Tomorrow's daily battle
INSERT INTO public.battle_daily (date, enemy_ids, coins_reward, dust_reward, xp_reward, energy_cost, is_active)
SELECT CURRENT_DATE + INTERVAL '1 day', 
       ARRAY[enemy1.id, enemy2.id],
       250, 60, 120, 1, true
FROM (SELECT id FROM public.battle_enemies WHERE tier = 'boss' ORDER BY RANDOM() LIMIT 1) enemy1,
     (SELECT id FROM public.battle_enemies WHERE tier = 'elite' ORDER BY RANDOM() LIMIT 1) enemy2;

-- Day after tomorrow
INSERT INTO public.battle_daily (date, enemy_ids, coins_reward, dust_reward, xp_reward, energy_cost, is_active)
SELECT CURRENT_DATE + INTERVAL '2 days', 
       ARRAY[enemy1.id, enemy2.id],
       300, 75, 150, 1, true
FROM (SELECT id FROM public.battle_enemies WHERE tier = 'boss' ORDER BY RANDOM() LIMIT 1) enemy1,
     (SELECT id FROM public.battle_enemies WHERE tier = 'boss' ORDER BY RANDOM() LIMIT 1) enemy2
ON CONFLICT (date) DO NOTHING;

-- ==========================================
-- COMMENTS
-- ==========================================
COMMENT ON TABLE public.battle_enemies IS 'Pre-defined enemy templates for PVE battles';
COMMENT ON TABLE public.battle_dungeons IS 'Battle stages/campaigns with progressive difficulty';
COMMENT ON TABLE public.user_battle_progress IS 'User PVE progress, stamina, and statistics';
COMMENT ON TABLE public.battle_logs IS 'History of all PVE battles';
COMMENT ON TABLE public.battle_daily IS 'Daily rotating battle configuration';
