# Weebx — Аниме Платформа с Gacha-Игрой

**Официальный сайт:** [Weeb-x.com](https://weeb-x.com)

Современная веб-платформа для просмотра аниме и чтения манги с встроенной коллекционной карточной игрой (CCG), торговой площадкой, PvP-боями и TV-режимом. Построена на Next.js 15 с использованием TypeScript, Tailwind CSS 4 и Supabase.

## 🌟 Основные возможности

### 📺 Аниме и Манга
- **Каталог аниме** — обширная база с фильтрацией по жанрам, годам, статусам и рейтингам
- **Просмотр в хорошем качестве** — интеграция с Kodik API, VK Video и прокси-плеерами
- **Запасной плеер на animdl** — прямой стрим AniLibria (русская озвучка) / AllAnime без VK-iframe
- **Скачивание серий** — mp4 / HLS-плейлист / торренты AniLibria + команда animdl CLI
- **Чтение манги** — агрегатор MangaDex, Comick, MangaLib, Remanga, MangaEden
- **Умные рекомендации** — персональные рекомендации на основе истории просмотров
- **Закладки и история** — сохранение тайтлов, отслеживание прогресса, архивация
- **Расписание** — расписание выхода новых серий
- **Новости** — агрегация аниме-новостей
- **Поиск с подсказками** — быстрый поиск по названию с историей запросов
- **Уведомления о сериях** — отслеживание выхода новых эпизодов

### 🎮 Gacha-Система
- **Коллекционные карты** — более 12 уровней редкости: от Trash до Omnipotent
- **Гача-паки** — различные наборы с разной стоимостью и шансами выпадения
- **Система пити (Pity)** — защита от невезения: прогрессирующий бонус-шанс на Rare+ карты
- **Распыление карт** — конвертация ненужных карт в Dust (пыль)
- **Модификаторы карт** — случайные бонусы к характеристикам
- **Многослойные арты** — кастомизация позиции арта на карте
- **Canvas-рендеринг** — высококачественный рендеринг карт через Canvas 2D API с GPU-ускорением
- **3D-вращение карт** — интерактивный просмотр карт с параллакс-эффектом

### ⚔️ Боевая Система (CCG)
- **Стратегические бои в стиле Marvel Snap / Gwent** — 3 раунда, 3 зоны, блеф и скрытый розыгрыш
- **Система провизии** — колода из 6 карт с лимитом веса 30 очков
- **Роли карт (КНБ)** — Авангард, Страж, Плут с бонусами друг против друга
- **Территориальные модификаторы** — процедурно генерируемые зоны с уникальными эффектами
- **Механика тени** — слепой розыгрыш второй карты каждого хода
- **ИИ-противник** — адаптивный ИИ с обучением и стратегическим выбором карт
- **Ежедневные бои** — ротация противников и наград

### 🏆 PvP-Режим
- **Онлайн-бои в реальном времени** — WebSocket-сервер на Socket.io
- **Матчмейкинг по MMR** — система рангов: Bronze → Grandmaster
- **ELO-рейтинг** — K-фактор 32, минимальный порог 800 MMR
- **Лидерборд** — таблица рейтинга с рангами

### 🏪 Торговая Площадка
- **Рынок карт** — выставление карт на продажу, покупка, отмена лотов
- **Аналитика цен** — статистика продаж, рекомендуемые цены, графики
- **Realtime-обновления** — обновление лотов в реальном времени через Supabase Realtime
- **Дашборд рынка** — детальная аналитика и история транзакций

### 📺 TV-Режим
- **Навигация с пульта (D-Pad)** — управление стрелками для Smart TV
- **Оптимизированный интерфейс** — крупные карточки, фокус-навигация
- **Голосовой поиск** — поиск аниме голосом
- **Полноэкранный плеер** — адаптированный просмотр для ТВ

### 🥚 Пасхалки
- **Скрытые события** — секретные взаимодействия и награды

### ⚙️ Прочее
- **Аутентификация** — профили пользователей, аватары, персонализация
- **Админ-панель** — управление контентом и карточками
- **SEO-оптимизация** — структурированные данные, sitemap, robots.txt
- **Темная тема** — комфортный просмотр в любое время суток
- **Адаптивный дизайн** — мобильные устройства, планшеты, десктоп, ТВ

## 🛠 Технологический стек

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS 4.1, shadcn/ui, Radix UI, Framer Motion, Lucide Icons
- **База данных**: Supabase (PostgreSQL, Realtime, Auth, Row Level Security)
- **Realtime PvP**: Socket.io (выделенный сервер)
- **API**: Shikimori, Kodik, Anilist, Jikan (MAL), Anilibria, MangaDex, Comick, MangaLib, Remanga
- **Кэширование**: LRU Cache, серверные API-прокси для предотвращения rate limiting
- **Аналитика**: Umami
- **Деплой**: Coolify (self-hosted)

## 📦 Установка и запуск

### Требования
- Node.js 18+
- npm

### Установка зависимостей
```bash
npm install
```

### Переменные окружения
Создайте файл `.env.local` в корне проекта:
```env
KODIK_API_TOKEN=your_kodik_api_token
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# PvP (онлайн-бои). Для локальной разработки подними сервер из pvp-server/ на 3001
# NEXT_PUBLIC_PVP_SERVER_URL=http://localhost:3001

# Umami (self-hosted аналитика). Обязателен только website id —
# без него аналитика выключена, остальное опционально.
NEXT_PUBLIC_UMAMI_WEBSITE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_UMAMI_URL=https://analytics.weeb-x.com
# NEXT_PUBLIC_UMAMI_SCRIPT_PATH=/script.js   # если в Umami задан TRACKER_SCRIPT_NAME
# NEXT_PUBLIC_UMAMI_DOMAINS=weeb-x.com       # сбор только с этих хостов
# NEXT_PUBLIC_UMAMI_TAG=production

# animdl (запасной плеер / скачивание). Всё опционально:
# секрет подписи прокси-ссылок (по умолчанию — случайный на процесс)
# ANIMDL_PROXY_SECRET=change-me-in-production
# endpoints AllAnime, если сайт переехал
# ALLANIME_SITE_URL=https://allanime.to/
# ALLANIME_API_URL=https://api.allanime.day/api
```

### Запуск разработки
```bash
npm run dev
```

Приложение будет доступно по адресу `http://localhost:80` (привязка к `0.0.0.0` для доступа по локальной сети).

### Сборка для продакшена
```bash
npm run build
npm start
```

## 🏗️ Структура проекта

```
├── app/                        # Next.js App Router
│   ├── actions/               # Server Actions
│   ├── admin/                 # Админ-панель
│   ├── anime/                 # Страницы аниме
│   ├── api/                   # API Routes (50+ эндпоинтов)
│   │   ├── animdl/            # Запасной плеер и скачивание (animdl: stream/download/hls/file/torrent)
│   │   ├── anime/             # API аниме
│   │   ├── backdrops/         # Фоновые изображения
│   │   ├── battle/            # API боевой системы
│   │   ├── card/              # API карт
│   │   ├── cards/             # API коллекции карт
│   │   ├── coins/             # API монет
│   │   ├── dust/              # API пыли
│   │   ├── gacha/             # API гача-круток
│   │   ├── home-data/         # API данных главной страницы
│   │   ├── image-proxy/       # Прокси изображений
│   │   ├── manga/             # API манги (8 эндпоинтов)
│   │   ├── market/            # API торговой площадки (11 эндпоинтов)
│   │   ├── pity/              # API системы пити
│   │   ├── posters/           # API постеров
│   │   ├── profile/           # API профиля
│   │   ├── proxy/             # Прокси-плееры
│   │   ├── recommendations/   # API рекомендаций
│   │   ├── region/            # API региона
│   │   ├── translate/         # API переводов
│   │   └── vk-video/          # API VK Video
│   ├── battle/                # Боевая система (CCG)
│   │   ├── ai/                # ИИ-противник с обучением
│   │   ├── ai-decks.ts        # Деки ИИ
│   │   ├── components/        # Компоненты боя
│   │   ├── config.ts          # Конфигурация боя
│   │   ├── hooks/             # Хуки боя
│   │   ├── types.ts           # Типы боя
│   │   └── utils.ts           # Утилиты боя
│   ├── beginners/             # Гайд для новичков
│   ├── bookmarks/             # Закладки
│   ├── catalog/               # Каталог
│   ├── contacts/              # Контакты
│   ├── dmca/                  # DMCA
│   ├── easter-eggs/           # Пасхалки
│   ├── faq/                   # FAQ
│   ├── gacha/                 # Gacha-система
│   │   ├── actions.ts         # Серверные действия гача
│   │   ├── art-sources.ts     # Источники артов
│   │   ├── client-actions.ts  # Клиентские действия
│   │   ├── coin-actions.ts    # Действия с монетами
│   │   ├── components/        # Компоненты гача
│   │   ├── config.ts          # Конфигурация гача
│   │   ├── dust-actions.ts    # Действия с пылью
│   │   ├── hooks/             # Хуки гача
│   │   ├── pity-actions.ts    # Система пити
│   │   ├── types.ts           # Типы гача
│   │   └── utils.ts           # Утилиты гача
│   ├── help/                  # Помощь
│   ├── history/               # История просмотров
│   ├── manga/                 # Чтение манги
│   ├── market-dashboard/      # Дашборд рынка
│   ├── news/                  # Новости
│   ├── pvp/                   # PvP-режим
│   ├── schedule/              # Расписание
│   ├── search/                # Поиск
│   ├── settings/              # Настройки
│   ├── terms/                 # Условия использования
│   ├── watch/                 # Страница просмотра
│   ├── globals.css            # Глобальные стили
│   ├── layout.tsx             # Главный layout
│   ├── not-found.tsx          # Кастомная 404 страница
│   ├── page.tsx               # Главная страница
│   └── sitemap.ts             # Динамический sitemap
├── components/                 # React компоненты
│   ├── auth/                  # Аутентификация
│   ├── battle/                # Компоненты боя
│   ├── beginners/             # Гайд для новичков
│   ├── catalog/               # Компоненты каталога
│   ├── gacha/                 # Компоненты гача (19 файлов)
│   ├── home/                  # Компоненты главной страницы
│   ├── layout/                # Компоненты лейаута
│   ├── manga/                 # Компоненты манги
│   ├── providers/             # Провайдеры контекста
│   ├── seo/                   # SEO-компоненты
│   ├── server/                # Серверные компоненты
│   ├── settings/              # Компоненты настроек
│   ├── shared/                # Общие компоненты
│   ├── tv/                    # TV-режим (11 компонентов)
│   ├── ui/                    # Базовые UI компоненты (shadcn/ui, 58 файлов)
│   └── watch/                 # Компоненты страницы просмотра
├── hooks/                      # Custom React Hooks
│   ├── use-coins.ts           # Хук монет
│   ├── use-dpad-navigation.ts # Навигация D-Pad для ТВ
│   ├── use-dust.ts            # Хук пыли
│   ├── use-episode-updates.ts # Отслеживание новых серий
│   ├── use-mobile.ts          # Определение мобильного
│   ├── use-toast.ts           # Уведомления
│   └── use-tv-mode.ts         # Режим ТВ
├── lib/                        # Утилиты и API-интеграции
│   ├── anilibria/             # Anilibria API
│   ├── comick/                # Comick API
│   ├── jikan/                 # Jikan (MAL) API
│   ├── mangadex/              # MangaDex API
│   ├── mangaeden/             # MangaEden API
│   ├── mangalib/              # MangaLib API
│   ├── myanimelist/           # MyAnimeList API
│   ├── remanga/               # Remanga API
│   ├── shikimori/             # Shikimori API (9 файлов)
│   ├── news/                  # Агрегатор новостей
│   ├── battle-engine.ts       # Движок боёв
│   ├── easter-eggs.ts         # Логика пасхалок
│   ├── gacha-packs.ts         # Конфигурация гача-паков
│   ├── genre-cache.ts         # Кэш жанров
│   ├── genre-fallback.ts      # Фоллбэк жанров
│   ├── hentai-detector.ts     # Детектор NSFW-контента
│   ├── kodik.ts               # Интеграция с Kodik
│   ├── logger.ts              # Логирование
│   ├── market-floor.ts        # Логика рынка
│   ├── rate-limit.ts          # Rate limiting
│   ├── supabase.ts            # Клиент Supabase
│   └── utils.ts               # Вспомогательные функции
├── public/                     # Статические файлы
├── pvp-server/                 # Socket.io сервер PvP (отдельный сервис, порт 3001)
├── scripts/                    # Скрипты для БД
├── supabase/                   # Миграции Supabase (37 SQL-файлов)
│   └── migrations/            # SQL миграции
├── types/                      # TypeScript типы
├── middleware.ts               # Next.js middleware
├── next.config.mjs             # Конфигурация Next.js
├── sitemap.xml                 # Sitemap
└── robots.txt                  # Robots
```

## 🔌 API Интеграции

### Shikimori API
Основной источник данных об аниме: тайтлы, рейтинги, отзывы, франшизы, связанные аниме.

### Kodik API
Стриминг видео: плеер, списки серий и озвучек, качество видео.

### Anilist API
Дополнительные изображения: постеры, обложки, фоновые изображения.

### Anilibria API
Альтернативный источник данных и плееров для аниме.

### Jikan (MyAnimeList) API
Дополнительные данные: жанры, рекомендации, топы.

### Manga API
Агрегация манги из MangaDex, Comick, MangaLib, Remanga, MangaEden.

### Supabase
База данных, аутентификация и realtime:
- Профили пользователей, монеты, пыль
- Коллекция карт, пити-система
- История просмотров, закладки
- Торговая площадка с realtime
- Боевая система, PvP-рейтинг
- Уведомления о новых сериях

## 🎨 Особенности реализации

### Серверные API-прокси
Все внешние API-запросы выполняются через серверные Next.js API-роуты для:
- Предотвращения CORS-ошибок
- Обхода клиентского rate limiting (429)
- Защиты приватности пользователей
- Кэширования через LRU Cache

### Оптимизация производительности
- Параллельные запросы к API
- LRU-кэширование данных
- Ленивая загрузка изображений
- Skeleton-загрузчики для всех карточек и постеров
- AbortController для отмены зависших запросов
- Оптимизация изображений: AVIF/WebP, multiple quality levels

### Gacha-рендеринг
- Canvas 2D API с GPU-ускорением (`desynchronized: true`)
- High-quality сглаживание, Retina-поддержка (devicePixelRatio)
- 3D-параллакс карт с многослойными артами
- Framer Motion анимации круток

### UI/UX
- Плавные анимации и переходы (Framer Motion)
- Адаптивная сетка карточек
- D-Pad навигация для Smart TV
- Поиск с автодополнением
- Toast-уведомления (Sonner)
- Drag-and-drop сортировка (@dnd-kit)

## 🧪 Автотесты

Полная инструкция: **[docs/TESTING.md](docs/TESTING.md)**.

```bash
npm test                 # unit + inventory API/страниц (секунды)
npm run test:watch       # watch-режим на время разработки
npm run test:e2e         # Playwright по всем публичным страницам
npm run test:coverage    # отчёт coverage/
```

Новая страница или API **обязаны** быть добавлены в `tests/registry/`, иначе CI красный. Шаблон теста фичи: `tests/templates/new-feature.test.template.ts`.

## 📝 Скрипты

- `npm run dev` — Запуск dev сервера (порт 80, `0.0.0.0`)
- `npm run build` — Сборка проекта
- `npm run start` — Запуск продакшн сервера (порт 80, `0.0.0.0`)
- `npm test` — Unit-тесты и инвентарь страниц/API
- `npm run test:e2e` — E2E в браузере (Playwright)
- `npm run test:coverage` — Покрытие кода

## 🚀 Развертывание

### Coolify (self-hosted)
1. Поднимите `Umami` в Coolify (сервис `umami` + `postgres:16-alpine`) и выдайте ему домен, например `https://analytics.weeb-x.com`.
2. В интерфейсе Umami создайте сайт (**Settings → Websites → Add website**) и скопируйте `data-website-id` из сниппета Tracking code.
3. Добавьте в приложение переменную `NEXT_PUBLIC_UMAMI_WEBSITE_ID` (и при необходимости `NEXT_PUBLIC_UMAMI_URL`).
4. Сделайте **Redeploy** приложения: `NEXT_PUBLIC_*` подставляются в бандл на этапе сборки.
5. Проверьте в DevTools → Network запрос `script.js` и `POST .../api/send`, а в Umami — вкладку Realtime.
6. Для браузерной проверки после деплоя: `npm run analytics:check` (без реальной отправки) или `npm run analytics:check -- --live` (несколько тестовых событий с тегом `audit:*`). Настройки Goals/Funnels/Journeys/Retention нужно отдельно проверить в панели — они не создаются кодом приложения.

> Полный пошаговый гайд — см. [`docs/UMAMI-COOLIFY.md`](docs/UMAMI-COOLIFY.md).

### PvP-сервер (онлайн-бои)

PvP — это **отдельный сервис**, а не часть Next.js-приложения: `pvp-server/` (Node 20 + Socket.io, порт 3001).

Локально:

```bash
cd pvp-server && npm install
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_KEY=<service_role> \
ALLOWED_ORIGINS=http://localhost:80 \
npm run dev        # http://localhost:3001/health
```

Coolify (self-hosted) — полный пошаговый гайд: **[docs/PVP-COOLIFY.md](docs/PVP-COOLIFY.md)**. Коротко:

1. Новый **Application** из этого же репозитория: Build Pack `Dockerfile`, Dockerfile Location `/pvp-server/Dockerfile`, Build Context Directory `/pvp-server`, Ports Exposes `3001`.
2. Домен сервиса: `https://pvp.weeb-x.com:3001` **или** тот же домен сайта через путь —
   `https://weeb-x.com:3001/pvp-ws` + `SOCKET_PATH=/pvp-ws/socket.io` + выключенный **Strip Prefixes**
   (порт в домене нужен Traefik’у; наружу 3001 не открывать).
3. Переменные сервиса: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ALLOWED_ORIGINS=https://weeb-x.com`.
4. В **приложении сайта**: `NEXT_PUBLIC_PVP_SERVER_URL=https://pvp.weeb-x.com` и обязательный **Redeploy с пересборкой** — `NEXT_PUBLIC_*` вшиваются в бандл на билде.
5. Проверка: `curl https://pvp.weeb-x.com/health` (или `https://weeb-x.com/pvp-ws/health`) и
   `[PvP] Connected to server` в консоли на `/pvp`.

PvP-сервер обязан быть доступен из браузера — адрес вида `http://pvp-server:3001` (внутренняя сеть
Coolify) не работает: сокет открывает клиент, а не Next.js. Обходной путь без нового домена — роут по пути
на основном домене, см. пункт 2 и раздел «1b» в [`docs/PVP-COOLIFY.md`](docs/PVP-COOLIFY.md).

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. Подробности в файле `LICENSE`.

## 🙏 Благодарности

- [Shikimori](https://shikimori.one) — за API и базу данных аниме
- [Kodik](https://kodik.cc) — за качественный стриминг
- [Anilist](https://anilist.co) — за постеры и фоновые изображения
- [Anilibria](https://anilibria.tv) — за альтернативный источник аниме
- [Jikan / MAL](https://jikan.moe) — за дополнительные данные
- [MangaDex](https://mangadex.org) — за API манги
- [Supabase](https://supabase.com) — за backend, auth и realtime
- [Coolify](https://coolify.io) — за платформу развертывания
- [Umami](https://umami.is) — за self-hosted аналитику

---

**Сделано с ❤️ для любителей аниме**