# Автотесты Weebx

Полное руководство: как запускать тесты, как добавлять новые, как не сломать прод при вводе фич.

Тесты нужны, чтобы **быстро проверять сайт целиком** после любой правки: гача, бои, рынок, каталог, API, страницы.

---

## 1. Зачем это

| Задача | Что делать |
|---|---|
| Проверить, что логика не сломалась | `npm run test:unit` (~несколько секунд) |
| Убедиться, что новые страница/API не забыты | тот же прогон — упадёт inventory |
| Прогнать сайт в браузере | `npm run test:e2e` |
| Покрыть новую фичу | чеклист в §5 + шаблон `tests/templates/new-feature.test.template.ts` |
| CI на каждый PR | `.github/workflows/test.yml` |

Слои:

```
tests/
  unit/          ← Vitest, без браузера. Чистая логика.
  api/           ← контракты API (методы, auth, реестр)
  e2e/           ← Playwright, реальный браузер
  registry/      ← список всех страниц и API
  fixtures/      ← фабрики карт / врагов / аниме
  helpers/       ← сканер app/ и утилиты
  templates/     ← заготовка теста новой фичи
  setup/         ← vitest.setup.ts
```

---

## 2. Быстрый старт

### Требования

- Node.js 18+
- `npm install` (подтянет Vitest, happy-dom, Playwright)

### Установка

```bash
npm install
```

Для E2E один раз ставим браузер Chromium:

```bash
npm run test:e2e:install
```

### Команды

| Команда | Что делает |
|---|---|
| `npm test` | Все unit + API тесты (Vitest, один прогон) |
| `npm run test:watch` | Vitest в watch-режиме — удобно во время разработки |
| `npm run test:unit` | То же, явно только unit/api |
| `npm run test:coverage` | Unit + отчёт покрытия `coverage/` |
| `npm run test:gacha` | Старый автотест гачи `scripts/gacha-autotest.mjs` |
| `npm run test:e2e` | Playwright против `http://localhost:3000` (сам поднимет Next на 3000) |
| `npm run test:e2e:ui` | Playwright UI-режим |
| `npm run test:all` | Unit, затем E2E |
| `npx vitest run путь/к/файлу.test.ts` | Один файл |

Watch по фильтру:

```bash
npx vitest battle
npx vitest gacha
npx vitest market
```

---

## 3. Что уже покрыто

### Unit (Vitest)

- **Утилиты:** `cn()`, логгер (редакция секретов), image-proxy, gift-card events
- **Гача:** 12 редкостей, dismantle, подпись карты, рейтинг коллекции, паки, кастом-паки, Pinterest-proxy
- **Бои / CCG:** сила команды и врагов, стамина, левелап, роли, провизия, КНБ, синергии колоды, территориальные модификаторы, авто-сборка колоды
- **ИИ:** адаптивный профиль сложности, оценка доски, симуляция хода, модель оппонента, `AIEngine` (power / round)
- **Рынок:** min/max цена, валидация, dismantle-формула
- **Каталог / Shikimori:** URL, транслит, search variants, NSFW-фильтр, трансформеры календаря и новостей, жанровый кэш/фоллбэк
- **Детектор хентая**, **easter eggs**, **фильтры каталога (localStorage)**
- **Rate limit** по IP

### Inventory (защита от «забыли протестить»)

Файлы `app/**/page.tsx` и `app/api/**/route.ts` **обязаны** быть в реестре:

- `tests/registry/pages.ts`
- `tests/registry/api-routes.ts`

Если добавить страницу и не вписать её в реестр — `npm test` упадёт с понятным сообщением.

### E2E (Playwright)

- Smoke всех публичных `smokePath` из реестра (не 5xx)
- Главная / каталог / легальные страницы / гача / бой
- Навигация на каталог, кастомная 404
- Поиск через query
- Публичные API GET + отказ анонимного POST `/api/coins`

---

## 4. Как запускать E2E

Playwright по умолчанию поднимает Next.js на порту **3000** (не 80, чтобы не нужен root):

```bash
npm run test:e2e:install   # один раз
npm run test:e2e
```

Если dev-сервер уже запущен — он будет переиспользован (`reuseExistingServer`).

### Против уже работающего сайта

```bash
PLAYWRIGHT_BASE_URL=http://localhost:80 PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e
```

### Против продакшена / стейджа

```bash
PLAYWRIGHT_BASE_URL=https://weeb-x.com PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e
```

Отчёт HTML: `playwright-report/index.html` после прогона.

Только десктоп:

```bash
npx playwright test --project=chromium
```

---

## 5. Чеклист новой фичи

Копируйте и отмечайте. Пока чеклист не зелёный — фичу не считать готовой.

### A. Страница (`app/.../page.tsx`)

1. Добавить запись в `tests/registry/pages.ts`:
   - `route` — как в App Router (`/watch/:id` для `[id]`)
   - `auth` — `public` | `optional` | `required` | `admin`
   - `smokePath` — URL для E2E или `null` (динамические без фикстуры)
2. Если страница публичная — smoke подхватит её сам.
3. Если есть уникальный UI — добавьте сценарий в `tests/e2e/`.

### B. API (`app/api/.../route.ts`)

1. Добавить запись в `tests/registry/api-routes.ts`:
   - `path`, `methods` (реально экспортируемые `GET`/`POST`/…), `auth`
2. Если `auth: "bearer"` / `"admin"` — в файле роута должна быть проверка `Authorization` / `getUser`.
3. Для новой бизнес-логики — unit-тесты на чистые функции, **не** на весь route с Supabase.

### C. Игровая логика (гача, бой, рынок)

1. Вынести формулы в чистые функции (уже так сделано в `lib/`, `app/battle/utils.ts`, `app/gacha/utils.ts`).
2. Скопировать `tests/templates/new-feature.test.template.ts`.
3. Покрыть: happy path, пустой ввод, верхнюю границу, регрессию соседней формулы.
4. Фикстуры карт/врагов — `tests/fixtures/cards.ts`, `tests/fixtures/battle.ts`.

### D. Перед коммитом

```bash
npm test
```

По желанию:

```bash
npm run test:coverage
npm run test:e2e
```

---

## 6. Как писать unit-тесты

Пример:

```ts
import { describe, expect, it } from "vitest"
import { getCardRole } from "@/app/battle/utils"
import { makeVanguard } from "../../fixtures/cards"

describe("getCardRole", () => {
  it("авангард при доминирующей атаке", () => {
    expect(getCardRole(makeVanguard())).toBe("vanguard")
  })
})
```

Правила:

- Алиас `@/` работает так же, как в приложении.
- DOM (`localStorage`, `window`) есть — окружение `happy-dom`.
- Не ходите в сеть. Мокайте `fetch` через `vi.stubGlobal("fetch", ...)`.
- Не импортируйте `"use server"` модули с живым Supabase (`app/gacha/actions.ts`). Тестируйте чистые куски рядом.
- Имена: `tests/unit/<область>/<модуль>.test.ts`.

Полезные фикстуры:

```ts
import { makeGachaCard, makeBattleCard, makeVanguard, makeGuard, makeTrickster } from "../../fixtures/cards"
import { makeEmptyZone, makeThreeZones, sampleDeck } from "../../fixtures/battle"
import { makeAnime, makeShikimoriAnime } from "../../fixtures/anime"
```

---

## 7. Как писать E2E

```ts
import { test, expect } from "@playwright/test"

test("каталог открывается", async ({ page }) => {
  const res = await page.goto("/catalog")
  expect(res?.status()).toBeLessThan(500)
  await expect(page.locator("body")).toBeVisible()
})
```

Советы:

- Не завязывайтесь на случайный текст с API Shikimori — он может не прийти в CI.
- Проверяйте: статус < 500, `body` виден, ключевые ссылки, 404.
- Авторизованные сценарии — через `storageState` (см. Playwright auth). Пока в репозитории нет тестового пользователя; не коммитьте секреты.

---

## 8. CI

Файл `.github/workflows/test.yml`:

- на `push` / `pull_request` в `main` гоняется `npm test` (unit + inventory);
- покрытие не блокирует мерж, но отчёт пишется;
- E2E в CI по умолчанию выключены (нужен поднятый Next + env). Включите job `e2e`, когда будет staging URL.

Локально то же самое, что в CI:

```bash
npm test
```

---

## 9. Покрытие (coverage)

```bash
npm run test:coverage
```

Отчёт: `coverage/index.html`.

Сейчас цель — **формулы и инварианты**, не 100% строк UI. Не гонитесь за покрытием `page.tsx` и shadcn — их ловят E2E.

Минимально держать зелёными:

- `lib/battle-engine.ts`
- `app/battle/utils.ts`
- `app/battle/config.ts`
- `app/gacha/utils.ts`
- `types/gacha.ts`
- `lib/market-floor.ts` / `market-floor-improved.ts`
- `lib/shikimori/utils.ts`

---

## 10. Переменные окружения тестов

| Переменная | Зачем |
|---|---|
| `PLAYWRIGHT_BASE_URL` | Базовый URL E2E (иначе `http://localhost:3000`) |
| `PLAYWRIGHT_SKIP_WEBSERVER` | Не поднимать Next, использовать уже запущенный сервер |
| `CI` | Строже Playwright (retries, forbid `test.only`) |

Unit-тестам **не нужны** `SUPABASE_*` / `KODIK_*`.

E2E против локального Next желательно иметь `.env.local` как для `npm run dev`. Без ключей страницы всё равно должны отвечать не 500 (мок Supabase в `lib/supabase.ts`).

---

## 11. Типичные поломки и что делать

**`Новые страницы без записи в реестре: /foo`**  
Добавьте `/foo` в `tests/registry/pages.ts`.

**`declared POST but exported [GET]`**  
В `api-routes.ts` указан метод, которого нет в `route.ts`. Поправьте реестр или экспорты.

**E2E: `net::ERR_CONNECTION_REFUSED`**  
Нет сервера. Запустите `npm run test:e2e` без `SKIP_WEBSERVER` либо поднимите dev сами.

**Тест флопает из‑за `Date.now()` / `Math.random()`**  
`vi.useFakeTimers()` + `vi.setSystemTime(...)`. Рандом в гacha/AI не ассертите точечно — проверяйте инварианты (диапазон, clamp, «не больше лимита»).

**Импорт `next/server` в unit**  
Ок для `lib/rate-limit.ts`. Если упадёт — мокайте:

```ts
vi.mock("next/server", () => ({ NextResponse: { json: () => ({}) } }))
```

---

## 12. Карта файлов

```
vitest.config.ts              # unit
playwright.config.ts          # e2e
tests/setup/vitest.setup.ts
tests/registry/pages.ts       # ОБЯЗАТЕЛЬНО обновлять
tests/registry/api-routes.ts  # ОБЯЗАТЕЛЬНО обновлять
tests/fixtures/               # тестовые данные
tests/unit/lib/               # lib/*
tests/unit/gacha/
tests/unit/battle/
tests/unit/inventory/         # полнота реестра
tests/api/                    # контракты route.ts
tests/e2e/                    # браузер
docs/TESTING.md               # этот файл
.github/workflows/test.yml
```

---

## 13. Договорённость команды

1. Новый `page.tsx` / `route.ts` без записи в реестре = красный CI.
2. Новая формула (урон, цена, редкость, пити) без unit-теста = не мержить.
3. `test.only` в CI запрещён.
4. Не пишите тесты, которые ходят в Shikimori / Kodik / Supabase без мока.
5. Документацию фичи дополняйте ссылкой на её тест.

Это и есть ускорение полной работы: после любой правки достаточно `npm test`, чтобы узнать, жив ли сайт, не забыта ли страница и не сломана ли экономика карт.
