-- Третий вид ожидания: 'dub-behind'.
--
-- Зачем
-- -----
-- Два прежних значения описывали точку входа — плашку в плеере:
--   'no-translations'     — озвучок/субтитров нет вовсе;
--   'episode-not-ready'   — озвучки есть, но человек упёрся в потолок
--                           серий по Shikimori, то есть ждёт СЕРИЮ.
-- Правило в lib/translation-alerts.ts переводило 'episode-not-ready' в
-- уведомление «новая серия», и это верно для плеера: там человек правда
-- ждёт новый эпизод.
--
-- Теперь то же ожидание заводит и кнопка «Следить за тайтлом» на странице
-- тайтла. Её обещание — озвучка: «у тайтла 3 озвучки, все отстают на серию,
-- как только любая догонит — сообщи». Это принципиально другое ожидание,
-- и втирать его в 'episode-not-ready' нельзя: уведомление пришло бы
-- «новая серия», хотя человек подписался на озвучку.
--
-- Отличать приходится хранилищем, потому что к моменту проверки разницы
-- уже не видно — Kodik отдаёт один и тот же список переводов.
--
-- Обратная совместимость
-- ----------------------
-- Старые строки не трогаем: 'no-translations' и 'episode-not-ready'
-- сохраняют прежнее поведение, включая текст уведомления.

ALTER TABLE public.translation_alerts
  DROP CONSTRAINT IF EXISTS translation_alerts_reason_check;

ALTER TABLE public.translation_alerts
  ADD CONSTRAINT translation_alerts_reason_check
  CHECK (reason IN ('no-translations', 'episode-not-ready', 'dub-behind'));

COMMENT ON COLUMN public.translation_alerts.reason IS
  'Откуда взялось ожидание: no-translations — озвучок нет вовсе; '
  'episode-not-ready — ждём серию (потолок Shikimori, плашка в плеере); '
  'dub-behind — ждём, пока хоть одна озвучка догонит (кнопка «Следить за тайтлом»).';