-- Migration: Добавить таблицы статистики аккаунта (user_activity_events + account_stats)
-- Запуск в Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- Idempotency: удалить старую консолидированную функцию и триггер перед пересозданием.
-- Сначала триггер (зависимый объект), затем функция — иначе ошибка 2BP01 "cannot drop function because other objects depend on it".
DROP TRIGGER IF EXISTS on_auth_user_created_final ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_final();

-- A. Таблица событий активности пользователя (append-only лог)
CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,          -- page_view, page_leave, watch_start, watch_end, gacha_roll, battle_started, bookmark_add, market_action, search_query
  category TEXT,                      -- time | viewing | activity (денормализовано для быстрой агрегации)
  payload JSONB DEFAULT '{}',         -- напр. {page, anime_id, duration_ms, timestamp}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для быстрой агрегации событий активности
CREATE INDEX IF NOT EXISTS idx_user_activity_events_user_id ON public.user_activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_events_user_category ON public.user_activity_events(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_activity_events_created_at ON public.user_activity_events(user_id, created_at);

-- B. Сводная таблица статистики аккаунта
CREATE TABLE IF NOT EXISTS public.account_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_sessions INTEGER DEFAULT 0,
  total_time_ms BIGINT DEFAULT 0,      -- суммарное время на сайте
  last_visit_at TIMESTAMPTZ,
  first_visit_at TIMESTAMPTZ,
  page_views INTEGER DEFAULT 0,
  watch_events INTEGER DEFAULT 0,       -- из истории просмотров / watch_start+end
  gacha_rolls INTEGER DEFAULT 0,
  battles_started INTEGER DEFAULT 0,
  bookmarks_added INTEGER DEFAULT 0,
  market_actions INTEGER DEFAULT 0,
  searches INTEGER DEFAULT 0,
  avg_session_ms BIGINT DEFAULT 0,
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для сводной таблицы статистики
CREATE INDEX IF NOT EXISTS idx_account_stats_user_id ON public.account_stats(user_id);

-- В. Включение RLS и политики доступа (как в user_cards)
ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own activity events" ON public.user_activity_events;
DROP POLICY IF EXISTS "Users can insert own activity events" ON public.user_activity_events;
DROP POLICY IF EXISTS "Users can delete own activity events" ON public.user_activity_events;
DROP POLICY IF EXISTS "Users can view own account_stats" ON public.account_stats;
DROP POLICY IF EXISTS "Users can insert own account_stats" ON public.account_stats;
DROP POLICY IF EXISTS "Users can update own account_stats" ON public.account_stats;
DROP POLICY IF EXISTS "Users can delete own account_stats" ON public.account_stats;

-- Политика: просмотр собственных событий активности
CREATE POLICY "Users can view own activity events"
  ON public.user_activity_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Политика: добавление собственных событий активности
CREATE POLICY "Users can insert own activity events"
  ON public.user_activity_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Политика: удаление собственных событий активности
CREATE POLICY "Users can delete own activity events"
  ON public.user_activity_events
  FOR DELETE
  USING (auth.uid() = user_id);

-- Политика: просмотр собственной статистики аккаунта
CREATE POLICY "Users can view own account_stats"
  ON public.account_stats
  FOR SELECT
  USING (auth.uid() = user_id);

-- Политика: добавление собственной статистики аккаунта
CREATE POLICY "Users can insert own account_stats"
  ON public.account_stats
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Политика: обновление собственной статистики аккаунта
CREATE POLICY "Users can update own account_stats"
  ON public.account_stats
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Политика: удаление собственной статистики аккаунта
CREATE POLICY "Users can delete own account_stats"
  ON public.account_stats
  FOR DELETE
  USING (auth.uid() = user_id);

-- D. Вспомогательные функции
CREATE OR REPLACE FUNCTION public.upsert_account_stats(user_id UUID, patch JSONB)
RETURNS UUID AS $$
DECLARE
  rec RECORD;
BEGIN
  SELECT * INTO rec FROM public.account_stats WHERE user_id = user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.account_stats (user_id) VALUES (user_id);
    GET DIAGNOSTICS rec.row_count = ROW_COUNT;
    IF rec.row_count = 0 THEN RETURN user_id; END IF;
  ELSE
    -- patch — JSONB вида '{"total_time_ms":12345}' — разворачивается в столбцы через динамический SQL
    EXECUTE FORMAT('UPDATE public.account_stats SET %s, last_updated_at = NOW() WHERE user_id = %L',
      COALESCE(replace(patch::text, '{',''), '}'), user_id);
  END IF;
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_activity_event(p_user_id UUID, p_event_type TEXT, p_category TEXT DEFAULT NULL, p_payload JSONB DEFAULT '{}')
RETURNS UUID AS $$
BEGIN
  INSERT INTO public.user_activity_events (user_id, event_type, category, payload)
  VALUES (p_user_id, p_event_type, p_category, COALESCE(p_payload, '{}'::jsonb))
  RETURNING id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- E. Аутентификационный триггер: добавляем создание записи account_stats в handle_new_user_final()
CREATE OR REPLACE FUNCTION public.handle_new_user_final()
RETURNS TRIGGER AS $$
BEGIN
  -- Создание профиля
  BEGIN
    INSERT INTO public.profiles (id, username, updated_at)
    VALUES (NEW.id, NEW.email, NOW())
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  END;

  -- Создание записи монет (начинается с 10000 монет)
  BEGIN
    INSERT INTO public.user_coins (id, coins)
    VALUES (NEW.id, 10000)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create coins for user %: %', NEW.id, SQLERRM;
  END;

  -- Создание записи pity
  BEGIN
    INSERT INTO public.user_pity (id, bad_luck_streak)
    VALUES (NEW.id, 0)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create pity for user %: %', NEW.id, SQLERRM;
  END;

  -- Создание записи dust
  BEGIN
    INSERT INTO public.user_dust (id, dust)
    VALUES (NEW.id, 0)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create dust for user %: %', NEW.id, SQLERRM;
  END;

  -- Создание записи прогресса боёв
  BEGIN
    INSERT INTO public.user_battle_progress (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create battle progress for user %: %', NEW.id, SQLERRM;
  END;

  -- Создание записи колод боёв
  BEGIN
    INSERT INTO public.user_battle_decks (user_id, card_ids, leader_id, formation)
    VALUES (NEW.id, '{}', NULL, 'balance')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create battle deck for user %: %', NEW.id, SQLERRM;
  END;

  -- Создание записи PvP-рейтинга
  BEGIN
    INSERT INTO public.user_ladder (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create ladder entry for user %: %', NEW.id, SQLERRM;
  END;

  -- Создание записи статистики аккаунта
  BEGIN
    INSERT INTO public.account_stats (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create account stats for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создание единого консолидированного триггера
CREATE TRIGGER on_auth_user_created_final
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_final();

COMMENT ON TABLE public.user_activity_events IS 'Append-only лог событий активности пользователя';
COMMENT ON COLUMN public.user_activity_events.id IS 'UUID идентификатор события';
COMMENT ON COLUMN public.user_activity_events.user_id IS 'ID пользователя (UUID из auth.users)';
COMMENT ON COLUMN public.user_activity_events.event_type IS 'Тип события (page_view, page_leave, watch_start, watch_end, gacha_roll, battle_started, bookmark_add, market_action, search_query)';
COMMENT ON COLUMN public.user_activity_events.category IS 'Категория: time | viewing | activity';
COMMENT ON COLUMN public.user_activity_events.payload IS 'Дополнительная нагрузка события (JSONB)';
COMMENT ON TABLE public.account_stats IS 'Сводная статистика аккаунта для каждого пользователя';
COMMENT ON COLUMN public.account_stats.id IS 'UUID идентификатор записи';
COMMENT ON COLUMN public.account_stats.user_id IS 'ID пользователя (UUID из auth.users, UNIQUE)';
COMMENT ON COLUMN public.account_stats.total_sessions IS 'Общее число сессий';
COMMENT ON COLUMN public.account_stats.total_time_ms IS 'Суммарное время на сайте (мс)';
COMMENT ON COLUMN public.account_stats.last_visit_at IS 'Время последнего визита';
COMMENT ON COLUMN public.account_stats.first_visit_at IS 'Время первого визита';
COMMENT ON COLUMN public.account_stats.page_views IS 'Общее число просмотров страниц';
COMMENT ON COLUMN public.account_stats.watch_events IS 'События просмотра (из истории просмотров)';
COMMENT ON COLUMN public.account_stats.gacha_rolls IS 'Число прокруток гача';
COMMENT ON COLUMN public.account_stats.battles_started IS 'Число начатых боёв';
COMMENT ON COLUMN public.account_stats.bookmarks_added IS 'Число добавленных закладок';
COMMENT ON COLUMN public.account_stats.market_actions IS 'Число действий на рынке';
COMMENT ON COLUMN public.account_stats.searches IS 'Число поисковых запросов';
COMMENT ON COLUMN public.account_stats.avg_session_ms IS 'Среднее время сессии (мс)';

-- F. Создание записей account_stats для существующих пользователей (backfill)
-- Агрегирует данные из существующих таблиц: bookmarks, watch_history, user_cards, pvp_logs, user_banner_pulls
INSERT INTO public.account_stats (user_id, total_sessions, total_time_ms, page_views, watch_events, gacha_rolls, battles_started, bookmarks_added, market_actions, searches, avg_session_ms, last_visit_at, first_visit_at)
SELECT
  u.id,
  0,
  0,
  0, -- page_views: нет исторических данных, начинается с 0
  (SELECT COUNT(*) FROM watch_history WHERE user_id = u.id),
  -- gacha_rolls: приоритет user_banner_pulls, fallback на user_cards / 10 (приблизительно)
  COALESCE(
    (SELECT SUM(pull_count) FROM user_banner_pulls WHERE user_id = u.id),
    (SELECT CEIL(COUNT(*)::numeric / 10) FROM user_cards WHERE user_id = u.id),
    0
  ),
  -- battles_started: только PvP (pvp_logs), PvE battle_logs может не существовать в старых базах
  COALESCE((SELECT COUNT(*) FROM pvp_logs WHERE player1_id = u.id OR player2_id = u.id), 0),
  (SELECT COUNT(*) FROM bookmarks WHERE user_id = u.id),
  COALESCE((SELECT COUNT(*) FROM market_listings WHERE seller_id = u.id), 0), -- market_actions: количество выставленных лотов
  0, -- searches: нет исторических данных
  0,
  COALESCE(
    (SELECT MAX(created_at) FROM watch_history WHERE user_id = u.id),
    (SELECT MAX(created_at) FROM bookmarks WHERE user_id = u.id),
    u.created_at
  ),
  u.created_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.account_stats WHERE user_id = u.id
);

-- G. Обновление существующих записей с актуальными данными (для всех пользователей)
-- Примечание: page_views и searches не обновляются из исторических данных (нет источника)
UPDATE public.account_stats
SET
  bookmarks_added = COALESCE(
    (SELECT COUNT(*) FROM bookmarks WHERE user_id = account_stats.user_id),
    0
  ),
  watch_events = COALESCE(
    (SELECT COUNT(*) FROM watch_history WHERE user_id = account_stats.user_id),
    0
  ),
  -- gacha_rolls: приоритет user_banner_pulls, fallback на user_cards / 10
  gacha_rolls = COALESCE(
    (SELECT SUM(pull_count) FROM user_banner_pulls WHERE user_id = account_stats.user_id),
    (SELECT CEIL(COUNT(*)::numeric / 10) FROM user_cards WHERE user_id = account_stats.user_id),
    0
  ),
  -- battles_started: только PvP (pvp_logs), PvE battle_logs может не существовать в старых базах
  battles_started = COALESCE(
    (SELECT COUNT(*) FROM pvp_logs WHERE player1_id = account_stats.user_id OR player2_id = account_stats.user_id),
    0
  ),
  market_actions = COALESCE(
    (SELECT COUNT(*) FROM market_listings WHERE seller_id = account_stats.user_id),
    0
  ),
  last_visit_at = COALESCE(
    (SELECT MAX(created_at) FROM watch_history WHERE user_id = account_stats.user_id),
    (SELECT MAX(created_at) FROM bookmarks WHERE user_id = account_stats.user_id),
    last_visit_at
  );
