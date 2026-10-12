-- ============================================================================
-- ПОДПИСКИ НА ТАЙТЛЫ (title_subscriptions)
-- ============================================================================
--
-- ЧТО БЫЛО НЕ ТАК
--   Уведомления о новых сериях приходили НЕ потому, что человек на это
--   подписался, а потому, что тайтл случайно оказался в `watch_history`
--   или в `bookmarks`. Список проверяемых тайтлов строился как их объединение
--   (components/providers/episode-updates-provider, checkAnimeUpdates).
--
--   Отсюда три следствия, и все три — невозможность управлять уведомлениями:
--     1. Отписаться нельзя. `watch_history` живёт вечно, поэтому уведомления
--        приходили даже после удаления из закладок.
--     2. Включить нельзя. Подписаться на тайтл можно было только там, где
--        контента прямо сейчас нет (плашка «Скоро / Озвучка не найдена»
--        внутри плеера). На нормальный тайтл кнопки подписки не было нигде.
--     3. Непонятно, за чем следят. Пользователь не мог посмотреть свой список
--        подписок, потому что его не существовало как сущности.
--
--   Вторая половина проблемы: `translation_alerts` — честная подписка на
--   конкретный тайтл, но её тоже можно было создать только из плашки в
--   плеере, и она живёт отдельно от «жду новых серий».
--
-- ЧТО СТАЛО
--   `title_subscriptions` — единственная явная сущность «я слежу за этим
--   тайтлом». Два независимых канала, потому что они закрывают разные
--   обещания:
--     notify_new_episodes — «напиши, когда выйдет следующая серия»
--                           (проверяется по episodes_aired из Shikimori);
--     notify_dub          — «напиши, когда появится озвучка»
--                           (проверяется по Kodik, это translation_alerts).
--
--   Закладки и история просмотров перестают быть триггером уведомлений
--   сами по себе: их роль теперь только в baseline (с какой серии человек
--   отстал) при создании подписки.
--
--   `source` помнит, откуда подписка взялась: 'manual' — человек нажал
--   кнопку, 'bookmark'/'watch_history' — перенесено миграцией из прежнего
--   неявного поведения, 'translation_alert' — человек ждал озвучку.
--   Это диагностика, а не логика: по source ничего не ветвится, чтобы
--   «перенесённое» нельзя было отличить от «неявного» иначе, чем по дате.
--
-- ПОРЯДОК ПРИМЕНЕНИЯ: миграция до деплоя приложения.
--   Применение безопасно и на живых данных: она переносит текущее
--   неявное поведение в явные подписки (backfill внизу), поэтому после
--   деплоя уведомления приходят ровно те же, что и до него.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.title_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- ID тайтла. В Weebx он совпадает с shikimori_id, по нему же Kodik ищет
  -- озвучки — отдельной колонки не нужно.
  anime_id TEXT NOT NULL,
  anime_title TEXT,
  poster TEXT,

  -- Канал «вышла новая серия». Проверяется по episodes_aired из Shikimori.
  notify_new_episodes BOOLEAN NOT NULL DEFAULT TRUE,
  -- Канал «появилась озвучка». Проверяется по Kodik через translation_alerts.
  notify_dub BOOLEAN NOT NULL DEFAULT TRUE,

  -- Откуда взялась подписка. Справочная колонка, не участвует в логике.
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'bookmark', 'watch_history', 'translation_alert')),

  -- Сколько серий человек уже видел на момент подписки. Точка отсчёта: без
  -- неё подписка на давно вышедший тайтл мгновенно дала бы ложное
  -- «вышла серия 12».
  baseline_episode INTEGER NOT NULL DEFAULT 0 CHECK (baseline_episode >= 0),

  -- Какую серию уже сообщили. Следующее уведомление придёт только если
  -- выйдет строго больше, поэтому повторов не бывает.
  last_notified_episode INTEGER,

  -- Когда сервер последний раз смотрел на этот тайтл. Троттлинг: озвучки и
  -- серии выходят не каждые 15 минут, а подписчиков могут быть тысячи.
  last_checked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Подписка без единого канала — бессмысленна: человек ничего не ждёт.
  -- CHECK, а не логика в приложении, чтобы «подписан, но не на что» даже
  -- нельзя было записать в таблицу.
  CONSTRAINT title_subscriptions_has_channel
    CHECK (notify_new_episodes OR notify_dub),

  -- Одна подписка на тайтл: повторное нажатие обновляет каналы и baseline,
  -- а не плодит дубликаты и дубли уведомлений.
  CONSTRAINT title_subscriptions_user_anime_unique UNIQUE (user_id, anime_id)
);

-- Основная выборка: подписки пользователя (страница настроек, колокольчик).
CREATE INDEX IF NOT EXISTS title_subscriptions_user_idx
  ON public.title_subscriptions (user_id, created_at DESC);

-- Серверный скан: подписки с notify_new_episodes. Частичный индекс — в
-- выборку попадает только то, что реально надо проверять. NULLS FIRST нужен
-- для того же, ради чего у translation_alerts есть такой же индекс: одно
-- «вечное» ожидание не должно намертво блокировать пачку.
CREATE INDEX IF NOT EXISTS title_subscriptions_episodes_idx
  ON public.title_subscriptions (last_checked_at, anime_id)
  WHERE notify_new_episodes;

-- updated_at обновляет триггер, а не клиент: иначе старый код, который эту
-- таблицу не знает, мог бы записать в updated_at мусор и тем самым сбить
-- выборки «давно не проверяли».
CREATE OR REPLACE FUNCTION public.update_title_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_title_subscriptions_update ON public.title_subscriptions;
CREATE TRIGGER on_title_subscriptions_update
  BEFORE UPDATE ON public.title_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_title_subscriptions_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Клиент читает и пишет свои подписки сам — так же, как `episode_updates`
-- и `translation_alerts`. Проверка озвучки идёт по Kodik на сервере
-- (service_role), RLS её не ограничивает.
-- ---------------------------------------------------------------------------
ALTER TABLE public.title_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their title subscriptions" ON public.title_subscriptions;
CREATE POLICY "Users can view their title subscriptions"
  ON public.title_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their title subscriptions" ON public.title_subscriptions;
CREATE POLICY "Users can insert their title subscriptions"
  ON public.title_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their title subscriptions" ON public.title_subscriptions;
CREATE POLICY "Users can update their title subscriptions"
  ON public.title_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their title subscriptions" ON public.title_subscriptions;
CREATE POLICY "Users can delete their title subscriptions"
  ON public.title_subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.title_subscriptions FROM anon;

-- ---------------------------------------------------------------------------
-- ПЕРЕНОС ТЕКУЩЕГО ПОВЕДЕНИЯ
-- ---------------------------------------------------------------------------
-- Без этого куска деплой молча отключил бы уведомления всем, кто сейчас
-- получает их по закладкам и истории: список проверяемых тайтлов стал бы
-- пустым. Переносим ровно то, что система делала неявно, и помечаем
-- source, чтобы в админке было видно, где подписки оставшиеся (1).
--
-- Приоритет source при конфликте: явное ожидание озвучки важнее закладки,
-- потому что человек нажал кнопку сам. Поэтому 'bookmark' идёт первым и
-- ON CONFLICT DO UPDATE НЕ перетирает source — только добирает каналы.
-- ---------------------------------------------------------------------------

-- 1. Закладки → ждём новые серии. Озвучка по закладке не ждалась никогда.
INSERT INTO public.title_subscriptions (user_id, anime_id, anime_title, poster, source, notify_new_episodes, notify_dub)
SELECT b.user_id,
       b.anime_id,
       NULLIF(b.anime_data ->> 'title', ''),
       NULLIF(b.anime_data ->> 'image', ''),
       'bookmark',
       TRUE,
       FALSE
FROM public.bookmarks b
ON CONFLICT (user_id, anime_id) DO NOTHING;

-- 2. История просмотров → ждём новые серии.
--    baseline = последняя просмотренная серия, а не 0: иначе человек,
--    досмотревший до 8-й, получил бы «вышло 9» с переходом «0 → 9».
INSERT INTO public.title_subscriptions (user_id, anime_id, source, notify_new_episodes, notify_dub, baseline_episode)
SELECT h.user_id,
       h.anime_id,
       'watch_history',
       TRUE,
       FALSE,
       COALESCE(MAX(h.episode), 0)
FROM public.watch_history h
GROUP BY h.user_id, h.anime_id
ON CONFLICT (user_id, anime_id) DO UPDATE
  SET baseline_episode = GREATEST(title_subscriptions.baseline_episode, EXCLUDED.baseline_episode);

-- 3. Ожидание озвучки → ждём озвучку. Само `translation_alerts` не трогаем:
--    оно продолжает работать как раньше, подписка лишь отражает его в общем
--    списке, чтобы подписки на озвучку были видны рядом с остальными.
INSERT INTO public.title_subscriptions (user_id, anime_id, anime_title, poster, source, notify_new_episodes, notify_dub, baseline_episode)
SELECT t.user_id,
       t.anime_id,
       t.anime_title,
       t.poster,
       'translation_alert',
       FALSE,
       TRUE,
       t.baseline_episode
FROM public.translation_alerts t
ON CONFLICT (user_id, anime_id) DO UPDATE
  SET notify_dub = TRUE,
      anime_title = COALESCE(title_subscriptions.anime_title, EXCLUDED.anime_title),
      poster = COALESCE(title_subscriptions.poster, EXCLUDED.poster);

COMMENT ON TABLE public.title_subscriptions IS
  'Явная подписка «слежу за тайтлом»: notify_new_episodes (Shikimori) + notify_dub (Kodik). Закладки и история больше не триггерят уведомления сами по себе';
COMMENT ON COLUMN public.title_subscriptions.notify_new_episodes IS
  'Писать, когда выйдет новая серия (эталоно episodes_aired из Shikimori)';
COMMENT ON COLUMN public.title_subscriptions.notify_dub IS
  'Писать, когда появится озвучка (реализация — translation_alerts, Kodik)';
COMMENT ON COLUMN public.title_subscriptions.baseline_episode IS
  'Сколько серий человек видел на момент подписки — точка отсчёта, защита от мгновенного ложного уведомления';
COMMENT ON COLUMN public.title_subscriptions.source IS
  'Откуда взялась подписка (manual/bookmark/watch_history/translation_alert). Справочно, в логике не участвует';