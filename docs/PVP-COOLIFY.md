# PvP-сервер на Coolify: запуск и подключение к сайту

Для онлайн-PvP сайту нужен отдельный процесс — Socket.io сервер из `pvp-server/`.
Next.js (`next start`) его не поднимает: у сайта свой порт 80, у PvP-сервера свой 3001, и это **два разных сервиса в Coolify**.

```
Браузер
  ├── https://weeb-x.com        → приложение Next.js (Coolify app, контейнер :80)
  └── wss://pvp.weeb-x.com      → Traefik :443 → pvp-server (Coolify app, контейнер :3001)
                                          │
Supabase ─────────────────────────────────┘  (auth-токены, user_ladder, pvp_logs, RPC update_pvp_mmr)
```

Клиент берёт адрес из `NEXT_PUBLIC_PVP_SERVER_URL`
(`app/battle/hooks/use-pvp-battle.ts`, дефолт `http://localhost:3001` — это значение для локальной разработки).
Отдельного прокси в Next.js не нужно — socket.io сам переходит на `wss://`, если страница открыта по `https://`.

---

## 0. Что должно быть готово до деплоя

- [ ] PvP-таблицы применены в Supabase: `20260609000000_create_pvp_system.sql`, `20260620000000_create_pvp_custom_rules.sql`, `20260621000000_fix_pvp_logs_relationships.sql`.
- [ ] Есть `service_role` ключ Supabase (не `anon`, не в `NEXT_PUBLIC_*`).
- [ ] На хостинге открыты только 80/443 — наружу 3001 публиковать **не нужно**, Traefik достанет контейнер по внутренней docker-сети.

## 1. Домен

PvP-серверу нужен **отдельный субдомен** (или отдельный поддомен + путь), потому что Traefik роутит по `Host`, а не по «домен + чужой порт сайта».

У DNS-провайдера добавь A-запись на IP нового сервера:

```
pvp.weeb-x.com.   A   <IP_твоего_хостинга>
```

Если в Coolify настроен wildcard (`*.weeb-x.com` → тот же IP), ничего добавлять не надо — можно сразу брать любое имя.
Let’s Encrypt сертификат Coolify выпустит сам при сохранении домена (проверь, что DNS уже разрешился — начиная с `beta.191` Coolify валидит DNS-записи через 1.1.1.1).

## 1b. Можно ли без отдельного домена? Да — через путь на `weeb-x.com`

Отдельный поддомен **не обязателен**: Coolify умеет роутить по пути (`Host + PathPrefix`), и
PvP-сервер может жить на том же домене, что и сайт, — `https://weeb-x.com/pvp-ws`.

| Шаг                       | Значение                                                            |
| ------------------------- | ------------------------------------------------------------------- |
| Domains (PvP-сервис)      | `https://weeb-x.com:3001/pvp-ws`                                    |
| Advanced → **Strip Prefixes** | **выключить** — иначе `/pvp-ws/socket.io` доедет до контейнера как `/socket.io` |
| Variables (PvP-сервис)    | `SOCKET_PATH=/pvp-ws/socket.io`                                     |
| Health Check → Path       | `/pvp-ws/health` (сервер принимает и `/health`, и с префиксом)       |
| Variables (сайт)          | `NEXT_PUBLIC_PVP_SERVER_URL=https://weeb-x.com` + `NEXT_PUBLIC_PVP_SOCKET_PATH=/pvp-ws/socket.io` |

Плюс: никакой DNS и отдельного сертификата, origin у сайта и PvP один (`https://weeb-x.com`) — CORS
перестаёт быть проблемой вообще.

Проверка:

```bash
curl -s https://weeb-x.com/pvp-ws/health
curl -s "https://weeb-x.com/pvp-ws/socket.io/?EIO=4&transport=polling&t=x"   # ждём "upgrades":["websocket"]
```

Важные оговорки:

- Не бери путь, который уже занят приложением: `/api` (там 50+ роутов Next.js) — конфликт.
  `/pvp-ws`, `/ws` или `/arena` свободны.
- Traefik матчит `PathPrefix` раньше корневого роута сайта, так что Next.js ничего не «перехватит»;
  в `middleware.ts` исключения добавлять не нужно.
- Багованный тандем «путь + включённый Strip Prefixes» — известная болячка Coolify
  (coollabsio/coolify#2603): всё начинает отдавать 404. Если 404 на `/pvp-ws/health` — значит
  Strip Prefixes не выключился, жми redeploy.

### А если совсем без публичного адреса — «чтобы смотрел внутри»?

Нет, не выйдет, и вот почему: сокет открывает **браузер игрока**, а не твой сервер.
`http://pvp-server:3001` — это DNS-имя внутренней docker-сети Coolify, из браузера оно не резолвится.
Внутрь сети ходят только серверные вызовы (Next.js API-роуты, SSR) — а PvP это двусторонний realtime из
клиента, его через `next start` не проксировать (Next не умеет websocket-upgrade в rewrites).

То есть PvP-серверу нужен любой публичный адрес, но «домен» в смысле покупки/DNS-настроики не обязателен:

- путь на существующем домене (вариант 1b выше) — 0 новых записей DNS;
- **sslip.io** от Coolify: в **Domains** вписать `https://pvp.<IP-сервера>.sslip.io:3001` — Coolify сам
  генерирует тестовый домен из IP, сертификат Let's Encrypt выдаст по HTTP-01 (порт 80 должен быть открыт);
- wildcard на твоём duckdns: у тебя уже `coolify.weebx.duckdns.org` — добавь в DuckDNS запись
  `*.weebx.duckdns.org` и получишь `pvp.weebx.duckdns.org` без возни с зоной.
  Минус duckdns: имя в URL выглядит чужеродно и сертификат придётся перевыпускать при смене IP.

Единственный способ **вообще** не выставлять PvP-сервер наружу — убрать из него realtime для браузера:
перевести бои на HTTP-запросы через Next.js API (или на Supabase Realtime, который уже публичный),
а сам socket.io-сервер оставить только внутри docker-сети. Это переделка матчагмайкинга и раундов,
не конфиг — за тебя я её не делал.

---

## 2. Создать сервис в Coolify (Dockerfile)

**Project → + New → Applications → Public (Git) →** репозиторий `SpikeSpieg-el/anime_host_anix1`, ветка `main`.

Дальше в настройках приложения:

| Поле (Coolify v4)              | Значение                          | Где                                          |
| ------------------------------ | --------------------------------- | -------------------------------------------- |
| Build Pack                     | `Dockerfile (Buildpack)`          | Advanced → Build Pack                        |
| Dockerfile Location            | `/pvp-server/Dockerfile`          | Advanced → Dockerfile                        |
| Build Context Location         | `/pvp-server`                     | Advanced → Build Context Directory           |
| Ports Exposes                  | `3001`                            | Advanced → Ports Exposes                     |
| Domains                        | `https://pvp.weeb-x.com:3001`     | General → Domains (порт = порт **внутри** контейнера) |
| Start Command                  | пусто (CMD из Dockerfile)         | Advanced → Start Command                     |

⚠️ `:3001` здесь — **только** чтобы Traefik знал, куда слать трафик внутри хоста. Браузер ходит на
обычные 443, порт в `NEXT_PUBLIC_PVP_SERVER_URL` писать не надо, и 3001 на файрволе не открывать.
По докам Coolify: **если порт в домене не указан, прокси шлёт запрос на 80 внутри контейнера** —
для нашего сервера это `No Available Server` / 502. Поэтому `:3001` обязателен.

Альтернатива — **Service → Docker Compose** с источником из этого же репо и путём `pvp-server/docker-compose.yml` (файл лежит в репозитории). Тогда порт домен берёт из `ports:`/`expose`, и там домен тоже указывается как `https://pvp.weeb-x.com:3001`.

## 3. Переменные окружения PvP-сервиса

**Resource → Variables** (или `Environment Variables`) → добавить и нажать **Save**:

```env
PORT=3001
HOST=0.0.0.0
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service_role JWT>
ALLOWED_ORIGINS=https://weeb-x.com,https://www.weeb-x.com,http://localhost:80
```

Значения:

- `SUPABASE_URL` — **тот же** проект, что у сайта (`NEXT_PUBLIC_SUPABASE_URL`). Иначе `auth.getUser(token)` не примет токены, выданные сайтом, и всех будет отцеплять с `Invalid authentication token`.
- `ALLOWED_ORIGINS` — списки через запятую, **без** завершающего слэша, с точным схемой+хостом. Не совпадает — клиент получит «PvP сервер недоступен» / `xhr poll error`.

Нажми **Deploy** (первый деплой соберёт образ на `node:20-alpine`, ~20 сек).

## 4. Health check

Coolify подхватывает `HEALTHCHECK` из `Dockerfile`. Если хочешь задать руками — **Advanced → Health Check**:

```
Enabled: yes · Method: GET · Path: /health · Port: 3001
Interval: 30s · Timeout: 5s · Retries: 3 · Start Period: 15s
```

`/health` отвечает сразу, без обращения к Supabase, так что unhealthy = проблема с портом/контейнером, а не с БД.

## 5. Проверить сервер

```bash
curl -i https://pvp.weeb-x.com/health
# {"status":"ok","uptime_seconds":42,"queue_size":0,"active_matches":0,"connected_users":0,...}

curl -s "https://pvp.weeb-x.com/socket.io/?EIO=4&transport=polling&t=x"
# 0{"sid":"...","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":30000,...}
```

Второй ответ означает, что handshake socket.io работает **и** доступен upgrade на WebSocket.
Смотрим лог: **Logs → Real-time** — должны быть строки `[PvP Server] Running on http://0.0.0.0:3001` и `[DB Cache] Refreshed: N rules, M locations`.

WebSocket через Traefik дополнительно настраивать не нужно (upgrade проксируется по умолчанию). Если перед Coolify стоит Cloudflare — во вкладке **Network включи WebSockets**, а SSL режим поставь `Full (strict)`.

## 6. Подцепить к сайту

1. **Приложение сайта в Coolify → Variables** → добавить:
   ```env
   NEXT_PUBLIC_PVP_SERVER_URL=https://pvp.weeb-x.com
   ```
   (без `/socket.io`, без слэша на конце, схема `https://` — сокет сам выбран `wss://`)
2. **Redeploy / Deploy** приложения. `NEXT_PUBLIC_*` вписываются в бандл **на этапе сборки**: просто сохранить переменную и ничего не пересобрать — значит ничего не изменить (вторая по частоте причина «PvP не работает» после переезда).
3. Открыть `https://weeb-x.com/pvp`, DevTools → Console:
   - `[PvP] Connecting to server: https://pvp.weeb-x.com`
   - `[PvP] Connected to server` ✅
   - если вместо этого `Connection failed` — смотри таблицу ниже.
4. Тест боя: два браузера (или обычный + инкогнито) с **разными** аккаунтами → оба жмут «Найти бой». В логах PvP-сервиса:
   `[Queue] User <id> joined (MMR: 1000, Queue size: 2)` → `match_found` → `round_resolved` → `match_ended`, затем `MMR Update Success` и `PvP Log Success`.
   Проверить запись: админка `Weebx → PvP` / `Battle Logs`, либо
   ```sql
   select player1_id, player2_id, winner_id, player1_mmr_after, created_at
   from pvp_logs order by created_at desc limit 5;
   ```

## 7. Troubleshooting

| Симптом                                              | Причина                                                        | Лечение                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `502/503 No Available Server`                        | Traefik не знает порт / контейнер unhealthy                    | В домене `:3001`, `Ports Exposes` = 3001, `PORT=3001`; `docker logs` сервиса                    |
| В консоли `CORS` / `xhr poll error`, PvP «недоступен» | `ALLOWED_ORIGINS` не содержит origin сайта                     | Добавить точный origin (https + домен), redeploy PvP-сервера                                     |
| `Mixed Content: try to connect to ws://…`            | На сайте стоит `http://` в `NEXT_PUBLIC_PVP_SERVER_URL`        | Поставить `https://…`, **пересобрать** приложение                                                |
| `Invalid authentication token`                       | Другой Supabase-проект на PvP-сервере или протухшая сессия     | Сверить `SUPABASE_URL`, перезайти на сайте                                                       |
| `join_queue` молчит / `Failed to join queue`          | Нет таблицы `user_ladder` или прав у `service_role`            | Применить `20260609000000_create_pvp_system.sql`                                                 |
| `match_ended` есть, а рейтинг не меняется             | Нет RPC `update_pvp_mmr`                                       | Применить миграции PvP; в логах строка `MMR Update Error`                                        |
| Подключается, но бои рвутся после редерлоя            | Состояние очереди/боёв в памяти контейнера                     | Нормально для одного реплики; не масштабировать >1 реплики без Redis-адаптера                   |
| Соединение обрывается через ~60 секунд простоя                       | Таймауты прокси перед Coolify                                   | Уже поднято в коде (`pingInterval 25s / pingTimeout 30s`); если есть внешний Nginx — `proxy_read_timeout 300s` |
| PvP недоступен на проде, а адрес `localhost:3001`   | Переменная не попала в билд                                    | Пункт 6.2 — redeploy с пересборкой                                                               |
| Роут по пути: 404 на `/pvp-ws/health`                | Strip Prefixes остался включён (coollabsio/coolify#2603)        | Advanced → Strip Prefixes = off, redeploy; `SOCKET_PATH` должен совпадать с префиксом домена     |
| Роут по пути: handshake есть, апгрейда нет           | `SOCKET_PATH` на сервере ≠ `NEXT_PUBLIC_PVP_SOCKET_PATH` у сайта | Оба значения = `/pvp-ws/socket.io`, сайт пересобрать                                              |

## 8. Обновление

`git push origin main` → Coolify делает redeploy по вебхуку (как и основной сайт, см. `.github/workflows/production-deployment.yml`).
Если меняешь только переменные PvP-сервера — редерлоя достаточно; если меняешь `NEXT_PUBLIC_PVP_SERVER_URL` сайта — нужна именно **пересборка** (Rebuild, а не Restart).
