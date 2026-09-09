# Umami на Coolify: self-hosted аналитика weeb-x.com

Сайт переехал на собственный хостинг **Coolify**, аналитика живёт там же — **Umami**
(лёгкая self-hosted альтернатива Google Analytics без cookies). Прежняя интеграция
PostHog удалена: Umami покрывает трафик, события и Web Vitals одним внешним скриптом
`script.js` и не тянет SDK в бандл приложения.

| Возможность | Vercel Analytics | Umami (self-hosted) |
| --- | --- | --- |
| Просмотры страниц / визиты | ✅ (лимит Hobby) | ✅ без лимитов |
| SPA-навигация Next.js | ✅ | ✅ (трекер сам ловит history API) |
| Кастомные события | ✅ | ✅ (`umami.track` + `data-umami-event`) |
| Источники перехода / UTM | ✅ | ✅ |
| Web Vitals (LCP/CLS/INP/FCP/TTFB) | ✅ | ✅ (`data-performance="true"`) |
| Клики по кнопкам/ссылкам | ❌ | ✅ (наш делегированный автотрек + `data-umami-event`) |
| Воронки / ретеншн по событиям | ❌ | ✅ (Funnels, Journey, Retention) |
| Cookies / баннер согласия | нужны | не нужны (мы всё равно gated согласием) |
| Данные принадлежат вам | частично | ✅ полностью, на вашем сервере |

## 1. Что уже развёрнуто в Coolify

Проект **weeb.x → production → service `umami-...`**:

| Компонент | Образ | Домен | Статус |
| --- | --- | --- | --- |
| Umami | `ghcr.io/umami-software/umami:3.0.3` | `https://analytics.weeb-x.com` | Running (healthy) |
| PostgreSQL | `postgres:16-alpine` | — (внутренняя сеть Coolify) | Running (healthy) |

TLS выдаёт Traefik/Caddy внутри Coolify — отдельно настраивать сертификат не нужно.

## 2. Создать сайт и получить `data-website-id`

1. Откройте `https://analytics.weeb-x.com` и войдите. При первой установке Umami создаёт
   пользователя **admin** с паролем **umami** — сразу смените его в **Settings → Profile**.
2. **Settings → Websites → Add website**.
   - **Name**: `weeb-x.com`
   - **Domain**: `weeb-x.com`
3. Откройте созданный сайт → **Tracking code**. Там будет сниппет вида:

```html
<script defer src="https://analytics.weeb-x.com/script.js" data-website-id="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"></script>
```

Нужен только UUID из `data-website-id` — это и есть `NEXT_PUBLIC_UMAMI_WEBSITE_ID`.

## 3. Переменные окружения приложения weeb-x (Coolify)

Coolify → проект **weeb.x** → окружение **production** → приложение → **Environment Variables**:

| Переменная | Обязательна | Значение |
| --- | --- | --- |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | **да** | UUID из шага 2. Без неё аналитика полностью выключена |
| `NEXT_PUBLIC_UMAMI_URL` | нет | `https://analytics.weeb-x.com` (это значение по умолчанию) |
| `NEXT_PUBLIC_UMAMI_SCRIPT_PATH` | нет | `/script.js`; меняется, если в Umami задан `TRACKER_SCRIPT_NAME` |
| `NEXT_PUBLIC_UMAMI_DOMAINS` | нет | например `weeb-x.com` — сбор только с этих хостов |
| `NEXT_PUBLIC_UMAMI_TAG` | нет | метка окружения, например `production` |

`NEXT_PUBLIC_*` подставляются в бандл **на этапе сборки**, поэтому после добавления
переменных нужен **Redeploy** приложения, а не только рестарт Umami.

## 4. Как это встроено в код

```
app/layout.tsx
└── <AnalyticsWrapper />            components/layout/analytics-wrapper.tsx
    ├── загрузка/выгрузка трекера по согласию на cookies
    ├── делегированный автотрек кликов (событие `click`) и форм (`form_submit`)
    ├── вовлечённость страницы (`engagement`: секунды + глубина скролла)
    └── identifyUser(`supabase:<uuid>`) для залогиненных

lib/analytics.ts                    trackEvent / trackPageview / identifyUser
components/providers/account-stats-recorder.ts
└── каждая внутренняя активность (gacha_roll, battle_started, watch_start,
    search_query, bookmark_add, page_leave...) дублируется в Umami
```

### Согласие на cookies
Пока пользователь не принял «Аналитику» в баннере (`ConsentProvider`), `script.js`
не вставляется в DOM и ни один запрос к Umami не уходит. Отзыв согласия убирает тег
скрипта (`unloadAnalyticsScript()`).

### Pageview в SPA
Трекер Umami сам перехватывает `history.pushState` / `replaceState` / `popstate`,
поэтому **не нужно** слать pageview вручную на смену `pathname` — будут дубли.
`trackPageview()` оставлен только для «виртуальных» экранов, которых нет в URL.

### Автотрек кликов
Делегированный слушатель в `AnalyticsWrapper` ловит клики по
`a[href]`, `button`, `[role="button|link|tab|menuitem|option"]`, `input[type=submit]`,
`summary` и элементам с `data-track`, и шлёт событие `click` с данными
`{ element, label, path, href?, id?, name? }`.

- отключить трек конкретного элемента: `data-track="off"`;
- задать свою подпись: `data-track="Открыть гачу"`;
- полностью своё событие без кода (нативный механизм Umami):

```tsx
<button
  data-umami-event="gacha_pack_open"
  data-umami-event-pack="2024"
>
  Крутить
</button>
```

> Не вешайте `data-umami-event` на внутренние `<Link>`: Umami делает им
> `preventDefault()` и переходит по `href` полной загрузкой страницы — потеряется
> клиентская навигация Next.js. Для ссылок работает автотрек `click`.

### CSP
`next.config.mjs` добавляет хост Umami в `script-src` и `connect-src`. Хост берётся из
`NEXT_PUBLIC_UMAMI_URL`, а при его отсутствии — `https://analytics.weeb-x.com`
(константа `DEFAULT_UMAMI_ORIGIN` в `lib/analytics.ts`).

## 5. Что уже трекается

| Событие | Где шлётся | Данные |
| --- | --- | --- |
| `pageview` | сам трекер (загрузка + SPA-навигация) | url, title, referrer, screen, language |
| `click` | автотрек в `AnalyticsWrapper` | `element`, `label`, `path`, `href`, `id`, `name` |
| `form_submit` | автотрек в `AnalyticsWrapper` | `path`, `id`, `name`, `action` |
| `engagement` | смена маршрута / уход со страницы | `path`, `seconds`, `max_scroll_pct` |
| `gacha_roll` | `activityRecorder` (мост в Umami) | payload активности |
| `gacha_card_revealed` | `use-gacha-state.ts` | `rarity`, `pack`, `anime`, `character`, `cost`, `guest` |
| `gacha_dismantle` | `use-gacha-state.ts` | `rarity`, `anime`, `dust` |
| `battle_started` | `activityRecorder` | payload активности |
| `pvp_started` | `use-battle-data.ts` | `opponent_id`, `mode` |
| `watch_start` / `watch_end` | `history-tracker.tsx` → мост | `anime_id` |
| `episode_play` | `watch-page-client.tsx` | `shikimori_id`, `title`, `episode`, `player` |
| `episode_change` | `watch-page-client.tsx` | `shikimori_id`, `title`, `episode` |
| `search_query` | `catalog-client.tsx` → мост | `query` |
| `bookmark_add` | `bookmarks-provider.tsx` → мост | payload активности |
| `market_buy` / `market_list` | маркет-панель / модал продажи | `listing_id` / `price`, `rarity`, `anime` |
| `manga_chapter_open` | `manga-detail-client.tsx` | `manga_id`, `chapter`, `provider` |
| `auth_sign_in` / `auth_sign_out` | `auth-provider.tsx` | `method` |
| `gift_card_redeem` | `navbar.tsx` | `already_claimed` |
| Web Vitals | трекер (`data-performance="true"`) | LCP, CLS, INP, FCP, TTFB |

Новые имена событий добавляйте в `AnalyticsEvent` (`lib/analytics.ts`) — иначе в
дашборде расплодятся варианты регистра.

## 6. Проверка

1. Откройте сайт, примите cookies (галочка «Аналитика»).
2. DevTools → Network → найдите запрос `script.js` с `analytics.weeb-x.com`
   и `POST .../api/send` (события). Статус 200 — всё работает.
3. В Umami: **Realtime** должен показать текущего посетителя, **Websites → weeb-x.com →
   Events** — события `click` / `engagement` и т.д.
4. Проверьте отзыв согласия: уберите галочку «Аналитика» в настройках cookie — тег
   `#umami-script` должен исчезнуть из `<head>`, новых запросов быть не должно.

## 7. Траблшутинг

| Симптом | Причина / решение |
| --- | --- |
| Нет вообще никаких данных | Не задан `NEXT_PUBLIC_UMAMI_WEBSITE_ID` или не было Redeploy после добавления переменной |
| `script.js` блокируется (ERR_BLOCKED_BY_CLIENT) | Ad-blocker режет путь `/script.js`. В Coolify у сервиса Umami задайте `TRACKER_SCRIPT_NAME=au`, перезапустите сервис и поставьте `NEXT_PUBLIC_UMAMI_SCRIPT_PATH=/au.js` |
| Скрипт грузится, но `POST /api/send` не уходит | Не принято согласие на аналитику; либо домен не совпадает с `NEXT_PUBLIC_UMAMI_DOMAINS`; либо у пользователя включён Do-Not-Track |
| В дашборде дубли pageview | Где-то вручную вызывается `trackPageview()`/`umami.track()` на смену маршрута — уберите, трекер делает это сам |
| Данные с localhost мешают | Задайте `NEXT_PUBLIC_UMAMI_DOMAINS=weeb-x.com` |
| Событий нет в Events, но визиты есть | События живут в **Websites → Events**, а не на графике pageview |

## 8. Ресурсы и эксплуатация

- Umami + PostgreSQL 16 занимают ~300–500 МБ RAM в idle — заметно легче PostHog CE.
- Бэкап: volume PostgreSQL сервиса (в Coolify → service → Persistent Storages).
- Обновление: смена тега образа `ghcr.io/umami-software/umami:3.x.y` → Deploy.
  Миграции Umami применяет сам при старте.
