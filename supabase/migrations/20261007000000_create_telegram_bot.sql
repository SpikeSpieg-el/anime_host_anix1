-- ============================================================================
-- TELEGRAM-БОТ: ПРИВЯЗКА АККАУНТА
-- ============================================================================
--
-- ЗАЧЕМ
--   Бот пишет игроку «у тайтла, который ты ждёшь, появилась озвучка».
--   Ожидание лежит в `translation_alerts`, где ключ — `user_id` из Supabase
--   Auth, а Telegram о таком id ничего не знает. Нужен словарь
--   `telegram_id ↔ user_id`, который переживает и переустановку приложения
--   (telegram_id у человека один), и смену @username.
--
--   Схема — по образцу активации Lampa (`lampa_device_codes`): короткий
--   код + TTL + статус. Отличие в том, что вместо ручного ввода PIN на ТВ
--   код открывается дееплинком прямо с сайта.
--
-- КТО КОНСУМИТ КОД
--   Сайт (`POST /api/telegram/link`, Bearer-токен пользователя) — не бот.
--   Так привязку может подтвердить только владелец аккаунта, и в одном
--   UPDATE с условием `status = 'pending'` не возникает гонки. Бот читает
--   результат и радуется.
--
-- RLS
--   Обе таблицы закрыты полностью: доступ только у service_role (бот и
--   серверные роуты). Клиенту сайта эта связка не нужна — он узнаёт свой
--   статус через GET /api/telegram/link, а не читает таблицу напрямую.
--
-- ПОРЯДОК ПРИМЕНЕНИЯ: миграция до деплоя приложения и бота.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Одноразовые коды привязки
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 8 символов без неоднозначных (I/O/0/1 убраны на стороне бота).
  code VARCHAR(8) NOT NULL UNIQUE,
  -- Bigint, не numeric: Telegram id — это int64, и он может превышать
  -- точность double, если хранить его в float8.
  telegram_id BIGINT NOT NULL,
  telegram_username TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'linked', 'expired')),
  -- Заполняется сайтом в момент подтверждения.
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  linked_at TIMESTAMPTZ
);

-- Бот ищет «мой живой код» по telegram_id + status.
CREATE INDEX IF NOT EXISTS telegram_link_codes_pending_idx
  ON public.telegram_link_codes (telegram_id, status, created_at DESC);

-- Подборка протухших кодов (чистка).
CREATE INDEX IF NOT EXISTS telegram_link_codes_expires_idx
  ON public.telegram_link_codes (expires_at)
  WHERE status = 'pending';

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to telegram link codes"
  ON public.telegram_link_codes;
CREATE POLICY "Service role full access to telegram link codes"
  ON public.telegram_link_codes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.telegram_link_codes FROM anon;
REVOKE ALL ON TABLE public.telegram_link_codes FROM authenticated;

-- ---------------------------------------------------------------------------
-- Связка Telegram-аккаунта с аккаунтом Weebx
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegram_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL UNIQUE,
  -- Личные сообщения: у личных чатов chat_id == user id, но храним явно —
  -- на случай появления групп/каналов в будущем.
  chat_id BIGINT NOT NULL,
  telegram_username TEXT,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Позволяет игроку глушить уведомления, не отвязывая аккаунт.
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_notification_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Скан рассылки ищет по набору user_id.
CREATE INDEX IF NOT EXISTS telegram_links_user_idx ON public.telegram_links (user_id);
CREATE INDEX IF NOT EXISTS telegram_links_chat_idx ON public.telegram_links (chat_id);

ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to telegram links"
  ON public.telegram_links;
CREATE POLICY "Service role full access to telegram links"
  ON public.telegram_links FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.telegram_links FROM anon;
REVOKE ALL ON TABLE public.telegram_links FROM authenticated;

-- ---------------------------------------------------------------------------
-- Чистка протухших кодов
-- ---------------------------------------------------------------------------
-- Коды живут 10 минут, но без чистки таблица растёт бесконечно. Вызывать из
-- крона (в боте это делает планировщик раз в цикл скана).
CREATE OR REPLACE FUNCTION public.cleanup_telegram_link_codes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.telegram_link_codes
  WHERE status = 'pending' AND expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON TABLE public.telegram_link_codes IS
  'Одноразовые коды привязки Telegram-аккаунта к Weebx; консумирует сайт (POST /api/telegram/link)';
COMMENT ON COLUMN public.telegram_link_codes.code IS
  '8 символов без I/O/0/1 — читается глазами и попадает в URL';
COMMENT ON TABLE public.telegram_links IS
  'Связка telegram_id ↔ user_id Weebx: по ней бот знает, кому слать уведомление об озвучке';
COMMENT ON COLUMN public.telegram_links.notifications_enabled IS
  'Игрок может отключить уведомления, не отвязывая аккаунт';