# WEEB-X Fallback Page

Статичная заглушка «Weebx временно недоступен»: её отдаёт прокси Coolify
(Caddy/Traefik) **только когда основной сайт (Next.js) не отвечает** — упал
контейнер, сломанный деплой, подвисший сборкой. Игрок видит стильную страницу
«мы не умерли, мы чиним» вместо голого 502/503.

> Пошаговый деплой и подключение к прокси — **[docs/FALLBACK-PAGE-COOLIFY.md](../docs/FALLBACK-PAGE-COOLIFY.md)**.

## Возможности

- Любой путь отдаёт `maintenance.html` со статусом **503 + Retry-After** (SEO-безопасно)
- Автопроверка: страница раз в 45 с пингует `/api/uptime-probe-9f3a`; у живого
  Next.js это 404 — страница сама делает reload и возвращает игрока на сайт
- Дизайн 1:1 с айдентикой сайта (та же система, что `app/not-found.tsx` и navbar):
  Unbounded/Inter/JetBrains Mono, световые сферы, стеклянные карточки, слово-зрачок
  «Weebx», арт из `public/baner error.png`, кнопка Telegram (чат), соцсети,
  поддержка, таймер «экран открыт N минут»

## Состав

| Файл | Роль |
| --- | --- |
| `html/maintenance.html` | Сама страница (CSS и JS инлайном, ~25 КБ) |
| `nginx.conf` | Любой путь → 503 + страница; исключения `/fonts/` и `/assets/` отдаются как 200 (шрифты и арт), `Cache-Control: no-store`, метка `X-Weebx-Fallback: 1` |
| `Dockerfile` | `nginx:alpine`, healthcheck по nginx (без `-f` — 503 для заглушки норма), smoke-тест конфига и файлов |
| `docker-compose.yml` | Деплой в Coolify как Docker Compose сервис, фиксированное имя контейнера `weebx-fallback` |
| `fonts/` | Копии шрифтов из `public/fonts` (Unbounded Bold, Inter Regular/Bold, JetBrains Mono Medium) — отдаются контейнером по `/fonts/` |
| `assets/` | `maintenance-girl.png` (копия `public/baner error.png`) — отдаётся по `/assets/` |
| `pages/` | Ярус-2: копия под GitHub Pages на случай смерти всего VPS (относительные пути, без автопробки), гайд внутри `pages/README.md` |

> Ассеты продублированы в сервисе (а не берутся из `public/` при сборке) потому,
> что build context в Coolify = `/fallback-page`; так Dockerfile не зависит от
> остального репозитория. Обновили картинку на сайте → переложите копию сюда и
> Redeploy.

## Локальная проверка

```bash
cd fallback-page && docker compose up --build
curl -si http://localhost:8080/watch/123 | head -5   # HTTP/1.1 503 + X-Weebx-Fallback
# а в браузере http://localhost:8080 — страница заглушки
```

## Лимиты и примечания

- Домен заглушке **не выдают**: она не должна получать прямой трафик — только
  fallback от прокси.
- В `tests/registry/` страница не попадает и не должна: реестр сканирует
  `app/**` (страницы Next.js), а заглушка живёт вне приложения. Приёмка —
  чеклист в гайде.
- Правки текста страницы или смена TG-ссылки — правкой одной строки в
  `html/maintenance.html` и Redeploy сервиса.
