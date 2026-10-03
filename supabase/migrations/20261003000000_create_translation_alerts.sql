-- ============================================================================
-- ОЖИДАНИЕ ОЗВУЧКИ (translation_alerts)
-- ============================================================================
--
-- ЧТО БЫЛО НЕ ТАК
--   Плашка «Скоро / Озвучка не найдена» на странице тайтла обещала гостю:
--   «зарегистрируйся — пришлём уведомление, когда серия появится». Кнопка
--   «Уведомить меня» при этом делала ТОЛЬКО push-подписку браузера
--   (public.push_subscriptions) и никак не связывала пользователя с аниме.
--
--   Реальный поиск новых серий (components/providers/episode-updates-provider)
--   строил список проверяемых тайтлов из watch_history ∪ bookmarks. У тайтла
--   без озвучки истории просмотра не существует физически, а в закладки
--   пользователь догадывался нажать не всегда → уведомление не приходило
--   никогда. Обещание воронки не выполнялось.
--
--   Вторая половина проблемы: проверка шла по episodes_aired из Shikimori, а не
--   по факту наличия озвучки в Kodik. «Появилась озвучка» не детектировалась
--   вовсе, а у онгоинга с уже вышедшими сериями подписчик мгновенно получал
--   ложное «вышла серия 12».
--
-- ЧТО СТАЛО
--   Клик по «Уведомить меня» создаёт строку здесь: user_id + anime_id + какую
--   серию ждём + сколько серий было известно на момент подписки (baseline).
--   Это единственный источник правды для гарантии «уведомление придёт»:
--   он не зависит ни от закладок, ни от истории просмотров.
--
--   POST /api/alerts/check проверяет Kodik по активным ожиданиям и при
--   появлении нужной серии шлёт web-push и пишет строку в episode_updates
--   (колокольчик на сайте), после чего помечает ожидание notified_at.
--
-- ПОРЯДОК ПРИМЕНЕНИЯ: миграция до деплоя приложения.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.translation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- ID тайтла. В Weebx id аниме совпадает с shikimori_id, по нему же
  -- Kodik ищет озвучки, поэтому отдельной колонки не нужно.
  anime_id TEXT NOT NULL,
  anime_title TEXT,
  poster TEXT,
  -- Какую серию пользователь пытался открыть (обычно 1 для тайтла без озвучки).
  episode INTEGER NOT NULL DEFAULT 1 CHECK (episode > 0),
  -- Сколько серий было известно на момент подписки: защита от мгновенного
  -- ложного «вышла серия N» и честный переход «было → стало» в колокольчике.
  baseline_episode INTEGER NOT NULL DEFAULT 0 CHECK (baseline_episode >= 0),
  -- 'no-translations' — озвучки/субтитров нет вовсе;
  -- 'episode-not-ready' — озвучки есть, но этой серии в них ещё нет.
  reason TEXT NOT NULL DEFAULT 'no-translations'
    CHECK (reason IN ('no-translations', 'episode-not-ready')),
  -- Когда в последний раз сервер спрашивал Kodik про этот тайтл (троттлинг).
  last_checked_at TIMESTAMPTZ,
  -- Когда ожидание закрылось и уведомление ушло. NULL = ещё ждём.
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Одно ожидание на тайтл: повторный клик обновляет серию/baseline,
  -- а не плодит дубликаты и дубликаты пушей.
  CONSTRAINT translation_alerts_user_anime_unique UNIQUE (user_id, anime_id)
);

-- Серверный скан активных ожиданий (ORDER BY last_checked_at NULLS FIRST).
CREATE INDEX IF NOT EXISTS translation_alerts_active_idx
  ON public.translation_alerts (user_id, notified_at, last_checked_at);

CREATE INDEX IF NOT EXISTS translation_alerts_anime_idx
  ON public.translation_alerts (anime_id)
  WHERE notified_at IS NULL;

ALTER TABLE public.translation_alerts ENABLE ROW LEVEL SECURITY;

-- Клиент читает/создаёт/отменяет свои ожидания сам (как в episode_updates).
-- Закрывает ожидание (notified_at) сервер через service_role — RLS его не
-- ограничивает, поэтому отдельной политики на «чужой» update не нужно.
DROP POLICY IF EXISTS "Users can view their translation alerts" ON public.translation_alerts;
CREATE POLICY "Users can view their translation alerts"
  ON public.translation_alerts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their translation alerts" ON public.translation_alerts;
CREATE POLICY "Users can insert their translation alerts"
  ON public.translation_alerts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their translation alerts" ON public.translation_alerts;
CREATE POLICY "Users can update their translation alerts"
  ON public.translation_alerts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their translation alerts" ON public.translation_alerts;
CREATE POLICY "Users can delete their translation alerts"
  ON public.translation_alerts
  FOR DELETE
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.translation_alerts FROM anon;

COMMENT ON TABLE public.translation_alerts IS
  'Подписка «жду озвучку/серию» по конкретному тайтлу: гарантия, что уведомление придёт даже без закладок и истории';
COMMENT ON COLUMN public.translation_alerts.baseline_episode IS
  'Сколько серий было известно на момент подписки — защита от ложного мгновенного уведомления';
COMMENT ON COLUMN public.translation_alerts.notified_at IS
  'NULL = ожидание активно; дата = уведомление уже отправлено';
