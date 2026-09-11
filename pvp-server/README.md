# WEEB-X PvP Server

Выделенный **Socket.io** сервер для онлайн-PvP (матчмейкинг по MMR, раунды, расчёт силы карт, запись результата в Supabase).

Клиент сайта подключается к нему из браузера напрямую:
`app/battle/hooks/use-pvp-battle.ts` → `NEXT_PUBLIC_PVP_SERVER_URL` (по умолчанию `http://localhost:3001`).

> Пошаговый деплой на Coolify и подключение к сайту — **[docs/PVP-COOLIFY.md](../docs/PVP-COOLIFY.md)**.

## Возможности

- `POST /socket.io/…` + WebSocket upgrade — весь realtime на одном порту (3001)
- `GET /health` (и `GET /<prefix>/health`) — статус, размер очереди, активные бои (для healthcheck’а Coolify и `curl`-проверки)
- Auth по Supabase access-токену: `socket.handshake.auth.token` → `supabase.auth.getUser(token)`
- События: `join_queue`, `leave_queue`, `place_cards` → `queue_joined`, `match_found`, `round_resolved`, `start_new_round`, `match_ended`, `opponent_moved`, `opponent_disconnect`, `error`
- Правила/локации кэшируются из БД каждые 5 минут (`pvp_rules`, `pvp_locations`), при пустой БД — встроенные модификаторы
- Итог боя: RPC `update_pvp_mmr` + `insert` в `pvp_logs`

## Состояние в памяти

Очередь, активные бои и MMR-контекст живут **в памяти процесса** (`Map`). Рестарт/редерлой сервиса = текущие бои и очередь сбрасываются (в `profiles`/`user_ladder` ничего не теряется). Поэтому:
- не включай автоскейлинг с репликами > 1 (игроки должны попадать в один контейнер);
- держи `restart: unless-stopped` и следи за healthcheck’ом.

## Переменные окружения

| Переменная          | По умолчанию              | Описание                                                              |
| ------------------- | ------------------------- | --------------------------------------------------------------------- |
| `PORT`              | `3001`                    | Порт HTTP + WebSocket                                                 |
| `HOST`              | `0.0.0.0`                 | Адрес привязки (в контейнере должен быть `0.0.0.0`)                   |
| `SUPABASE_URL`      | — (обязательно)           | URL проекта Supabase, **тот же**, что `NEXT_PUBLIC_SUPABASE_URL` сайта |
| `SUPABASE_SERVICE_KEY` | — (обязательно)        | `service_role` ключ (сервер падает на старте без него)                |
| `ALLOWED_ORIGINS`   | `http://localhost:3000`   | CORS-ориджи сайта, через запятую                                       |
| `SOCKET_PATH`       | `/socket.io`              | Путь socket.io. Ставь `/pvp-ws/socket.io`, если проксирует Coolify по пути основного домена |

Сервер **не стартует** без `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — это осознанный fail-fast, чтобы не ловить «PvP недоступен» на проде.

## Локальная разработка

```bash
cd pvp-server
npm install

# вариант 1: env в строке запуска
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_KEY=eyJ...service_role... \
ALLOWED_ORIGINS=http://localhost:80,http://localhost:3000 \
npm run dev

# вариант 2: через .env (файл в .gitignore)
printf 'SUPABASE_URL=...\nSUPABASE_SERVICE_KEY=...\nALLOWED_ORIGINS=http://localhost:80\n' > .env
npm run dev
```

Рядом нужно поднять сайт с `NEXT_PUBLIC_PVP_SERVER_URL=http://localhost:3001`.

Проверка, что сервер живой:

```bash
curl -s localhost:3001/health
curl -s "localhost:3001/socket.io/?EIO=4&transport=polling"   # ждём "upgrades":["websocket"]
```

Через Docker:

```bash
cd pvp-server
SUPABASE_URL=... SUPABASE_SERVICE_KEY=... ALLOWED_ORIGINS=http://localhost:80 \
  docker compose up --build
```

## Миграции БД

PvP требует таблицы рейтинга и RPC. Применить в Supabase (SQL editor) или `supabase db push`, если ещё не применены:

- `supabase/migrations/20260609000000_create_pvp_system.sql` — `user_ladder`, `pvp_logs`, `update_pvp_mmr()`, `calculate_rank_tier()`
- `supabase/migrations/20260620000000_create_pvp_custom_rules.sql` — `pvp_locations`, `pvp_rules`, `pvp_location_rules`
- `supabase/migrations/20260621000000_fix_pvp_logs_relationships.sql` — FK-правки для логов

Без первых двух сервер запустится, но `join_queue` (чтение `user_ladder`) и завершение боя (RPC + `pvp_logs`) будут падать в логи.
