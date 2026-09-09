# PostHog на Coolify: замена Vercel Analytics полной self-hosted аналитикой

Проект переехал с Vercel на собственный хостинг **Coolify**. У Coolify нет встроенной
аналитики и дашбордов — это нормально, он **платформа деплоя**. Аналитику даёт отдельный
self-hosted сервис. Здесь это **PostHog Community Edition**, который разворачивается в
том же Coolify и даёт заметно больше, чем Vercel Analytics даже в тарифе Pro.

| Возможность | Vercel Analytics (Hobby/Pro) | PostHog CE (self-hosted) |
| --- | --- | --- |
| Просмотры страниц | ✅ (лимит Hobby) | ✅ без лимитов |
| Клики по кнопкам/ссылкам | ❌ | ✅ автозахват (autocapture) |
| Источники перехода / UTM | ✅ | ✅ (глубже: по событиям) |
| Воронки | ❌ | ✅ |
| Ретеншн пользователей | ❌ | ✅ |
| Записи сессий (session replay) | ❌ (только Pro-платно у Vercel? нет) | ✅ |
| Тепловые карты (heatmaps) | ❌ | ✅ |
| Feature flags / A/B-тесты | ❌ | ✅ |
| Профили залогиненных юзеров | ❌ | ✅ (identify) |
| Данные принадлежат вам | частично | ✅ полностью, на вашем сервере |

## 1. Что разворачивать в Coolify

PostHog CE — это много контейнеров (PostgreSQL + ClickHouse + Redis + app + worker + Kafka),
поэтому ему нужно заметно больше памяти, чем простой аналитике. Если у вас «только трефик
сайта», а не поведение пользователей — см. внизу пункт «Альтернативы с меньшим весом».

Минимум ресурсов для PostHog CE:
- **8 GB RAM** — комфортный минимум (idle ~2 GB);
- у вас 32 GB и готовность выделить 10–20 GB — идеально;
- старый x86-64 CPU подойдёт (все образы PostHog/ClickHouse есть под amd64).

### Способ A — one-click шаблон (если доступен)
Coolify поддерживает шаблоны приложений. В «New Resource» поищите **PostHog** —
разверните, следуя полям формы (укажите домен, данные PostgreSQL/Redis, которые Coolify
создаст автоматически). Остальная инфраструктура развернётся сама.

### Способ B — docker-compose (точный контроль)
Используйте официальный репозиторий образов/конфигурации PostHog для self-host:
`posthog/posthog` (release). В Coolify создайте Docker Compose-проект и опишите сервисы.
Свежие официальные инструкции и пример `docker-compose.yml` — в документации PostHog
«Deploy PostHog in production» / репозиторий `PostHog/deployment-examples`.

Общий принцип (примерная схема, уточняйте по актуальному compose):
```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: posthog
      POSTGRES_USER: posthog
      POSTGRES_PASSWORD: <strong-password>
    volumes: [ "pgdata:/var/lib/postgresql/data" ]
  clickhouse:
    image: clickhouse/clickhouse-server:23.8
    ulimits: { nofile: { soft: 262144, hard: 262144 } }
    volumes: [ "chdata:/var/lib/clickhouse" ]
  redis:
    image: redis:6-alpine
  web:
    image: posthog/posthog:release-1.43.x   # ставьте конкретный тег, не latest
    depends_on: [postgres, clickhouse, redis]
    environment: &ph-env
      SECRET_KEY: <random-64-chars>
      DATABASE_URL: postgres://posthog:<strong-password>@postgres:5432/posthog
      CLICKHOUSE_DATABASE: posthog
      CLICKHOUSE_HOST: clickhouse
      CLICKHOUSE_USER: default
      REDIS_URL: redis://redis:6379/
      POSTHOG_HOST: https://analytics.weeb-x.com
      SITE_URL: https://analytics.weeb-x.com
      IS_BEHIND_PROXY: "true"
      # всё остальное берётся по умолчанию
    command: ./bin/docker-server
    volumes: [ "webdata:/app/var" ]
  worker:
    image: posthog/posthog:release-1.43.x
    depends_on: [postgres, clickhouse, redis]
    environment: *ph-env
    command: ./bin/docker-worker
    volumes: [ "workerdata:/app/var" ]
  ...
```

### 2. Настройте домен и TLS
В Coolify назначьте ресурсу PostHog (сервис `web`) домен, например
`analytics.weeb-x.com` — Coolify выпустит Let's Encrypt-сертификат сам. После этого
PostHog должен открываться по HTTPS. Все трафик от сайта идёт именно на этот URL.

### 3. Создайте проект и API key
В дашборде PostHog:
1. Создайте «Project» для weeb-x.
2. Откройте `Project Settings → Project API Key` — это значение `phc_...`.
3. Запишите:
   - `NEXT_PUBLIC_POSTHOG_KEY` = `phc_...`
   - `NEXT_PUBLIC_POSTHOG_HOST` = `https://analytics.weeb-x.com` (без слэша в конце)

### 4. Пропишите env в проекте weeb-x (Coolify)
В ресурсе вашего Next.js приложения добавьте две переменные окружения (см. README):
```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://analytics.weeb-x.com
```
После этого пересоберите/перезапустите приложение.

### 5. Проверка
- Откройте сайт, зайдите в раздел «Живые» (Live events) в PostHog — должны сыпаться события
  `$pageview` и autocapture-события при кликах.
- Session replay: включите в настройках проекта «Record user sessions»; в просмотрах
  записей появятся записи сессий.
- `identify()` уже встроен: залогиненные пользователи привязываются к профилю
  `supabase:<user_id>`, чтобы аналитика была консистентна между устройствами.

## 5. Как это встроено в код

Файл `components/layout/analytics-wrapper.tsx`:
- инициализирует PostHog **только если** пользователь согласился на «Аналитику»
  в баннере cookie (иначе SDK не грузится и ничего не отправляется);
- ловит каждый переход по SPA и шлёт `$pageview`;
- включает **autocapture** — клики по кнопкам/ссылкам/формам трекаются без ручной
  разводки по каждому элементу;
- при залогиненном пользователе вызывает `posthog.identify(...)`.

Для бизнес-событий, которые PostHog не выведет из клика (например, «крутка гачи»,
«старт PvP-боя»), из этого файла экспортируется `trackEvent(event, properties)`:
```ts
import { trackEvent } from "@/components/layout/analytics-wrapper"
trackEvent("gacha_pull", { rarity: "UR", banner: "summer" })
```
`trackEvent` безопасен (no-op), если аналитика не инициализирована или юзер не дал согласие.

### CSP
CSP (`next.config.mjs` и `middleware.ts`) уже разрешает `connect-src` и `wss://` для
`NEXT_PUBLIC_POSTHOG_HOST` (нужно для сессион-записей). Менять вручную не требуется —
достаточно указать env.

## Когда PostHog — перебор

Если аналитика нужна только «сколько людей и откуда» без поведения/сессий, PostHog
тяжёлый. Легче альтернативы, которые тоже ставятся в Coolify в один клик:
- **Umami** (Node + PostgreSQL, ~0.5 GB, MIT) — клики/события, минимальный вес;
- **Plausible CE** (Elixir + ClickHouse, 2–4 GB) — полированный UI, цели/воронки.

Правило: **Plausible/Umami** — если важны просмотры и источники; **PostHog** — если нужны
клики по элементам, воронки, ретеншн, записи сессий, A/B — то есть «трекать всё».
