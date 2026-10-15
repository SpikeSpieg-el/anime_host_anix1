-- ============================================================================
-- МНЕНИЯ РЕДАКЦИИ (editorial_reviews) — ЗАКРЫТИЕ ТАБЛИЦЫ
-- ============================================================================
--
-- ЗАЧЕМ
--   Таблица создана вне репозитория, поэтому её RLS-состояние нельзя было
--   проверить по коду. Вкладка «Редакция» в админке писала в неё напрямую
--   из браузера через anon-ключ (@/lib/supabase) — авторизация держалась
--   ИСКЛЮЧИТЕЛЬНО на RLS.
--
--   Это опасно вдвойне:
--     1) если anon-роли оставалась хотя бы одна политика на INSERT/UPDATE/
--        DELETE, любой неавторизованный посетитель мог переписать текст;
--     2) контент рендерится на ПУБЛИЧНОЙ странице тайтла для всех гостей
--        через parseInlineMarkdown, поэтому запись в таблицу = stored XSS
--        для всего трафика.
--
--   В коде оба пути закрыты:
--     - редактирование переведено на server action (app/admin/actions.ts:
--       getEditorialReviews / upsertEditorialReview / deleteEditorialReview),
--       каждая проходит через checkAdminAuth() внутри getAdminSupabase();
--     - parseInlineMarkdown пропускает только http/https и относительные
--       ссылки (sanitizeEditorialLink), всё остальное рендерится текстом.
--
--   Эта миграция — третий рубеж: даже если anon-ключ утечёт, писать в
--   таблицу он не сможет.
--
-- ЧТО РАЗРЕШЕНО
--   anon / authenticated → SELECT. Публичная страница тайтла
--   (app/watch/[id]/page.tsx, getEditorialReview) читает мнение через
--   anon-ключ — это по замыслу публичный контент.
--
--   Запись (INSERT/UPDATE/DELETE) → только service_role. Он обходит RLS,
--   поэтому серверные экшены продолжают работать без изменений.
--
-- ПОРЯДОК ПРИМЕНЕНИЯ: миграция до деплоя приложения.
--   Пока таблица не закрыта, вкладка «Редакция» уже пишет через серверный
--   экшен — миграция ничего не ломает, она лишь снимает зависимость от
--   неизвестного прежнего состояния.
-- ============================================================================

-- Схема фиксируется здесь явно: на чистой установке таблица создаётся
-- этой миграцией, на существующей базе CREATE IF NOT EXISTS её не трогает.
CREATE TABLE IF NOT EXISTS public.editorial_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Shikimori ID тайтла: мнение одно на тайтл, отсюда UNIQUE + upsert.
  anime_id TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'Редакция Weebx',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS editorial_reviews_updated_at_idx
  ON public.editorial_reviews (updated_at DESC);

-- Обновление updated_at на стороне БД, чтобы «последнее изменение» нельзя
-- было подделать клиентским payload'ом и чтобы оно работало для любой
-- записи, а не только для нашего экшена.
CREATE OR REPLACE FUNCTION public.set_editorial_reviews_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS editorial_reviews_set_updated_at ON public.editorial_reviews;
CREATE TRIGGER editorial_reviews_set_updated_at
  BEFORE UPDATE ON public.editorial_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_editorial_reviews_updated_at();

-- Главное. Без ENABLE ROW LEVEL SECURITY таблица открыта ВСЕМ ролям,
-- включая anon, независимо от грантов.
ALTER TABLE public.editorial_reviews ENABLE ROW LEVEL SECURITY;

-- Полный сброс политик: прежнее состояние неизвестно, поэтому старые
-- правила не «донастраиваем», а удаляем. Ниже создаём ровно одно.
DROP POLICY IF EXISTS "anon can read editorial reviews" ON public.editorial_reviews;
DROP POLICY IF EXISTS "authenticated can read editorial reviews" ON public.editorial_reviews;
DROP POLICY IF EXISTS "anyone can insert editorial reviews" ON public.editorial_reviews;
DROP POLICY IF EXISTS "anyone can update editorial reviews" ON public.editorial_reviews;
DROP POLICY IF EXISTS "anyone can delete editorial reviews" ON public.editorial_reviews;

-- Только чтение для публичной части приложения.
-- Политик на INSERT/UPDATE/DELETE НЕТ НАМЕРЕННО: при включённом RLS
-- отсутствие политики означает запрет, а не «наследуемое поведение».
CREATE POLICY "anon can read editorial reviews"
  ON public.editorial_reviews
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "authenticated can read editorial reviews"
  ON public.editorial_reviews
  FOR SELECT
  TO authenticated
  USING (true);

-- Гранты приводим в соответствие с политиками. anon получает только
-- SELECT — даже если политику кто-то случайно ослабит, роль не сможет
-- писать на уровне привилегий таблицы.
REVOKE ALL ON public.editorial_reviews FROM anon;
REVOKE ALL ON public.editorial_reviews FROM authenticated;
GRANT SELECT ON public.editorial_reviews TO anon;
GRANT SELECT ON public.editorial_reviews TO authenticated;
-- service_role обходит RLS и остаётся единственной ролью с правом записи.
GRANT ALL ON public.editorial_reviews TO service_role;

COMMENT ON TABLE public.editorial_reviews IS
  'Мнения редакции. Публичное чтение (anon), запись — только service_role '
  'через server action в app/admin/actions.ts.';

COMMENT ON COLUMN public.editorial_reviews.anime_id IS
  'Shikimori ID тайтла; одно мнение на тайтл (UNIQUE, upsert по anime_id).';