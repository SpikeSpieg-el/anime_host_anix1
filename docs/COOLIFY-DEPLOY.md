# Деплой на Coolify: сайт + image-service

Проект состоит из **двух отдельных сервисов** в Coolify:

| Сервис | Что собирает | Dockerfile | Порт |
|---|---|---|---|
| **Сайт** (Next.js) | `Dockerfile.site` | `/Dockerfile.site` | 80 |
| **Image-service** (прокси/оптимизация картинок) | корневой `./Dockerfile` | `/Dockerfile` | 3100 |

⚠️ Корневой `./Dockerfile` собирает **image-service**, а не сайт. Не перепутай.

---

## 1. Image-service (`img.weeb-x.com`)

1. В Coolify создать приложение из этого репозитория, Build Pack = **Dockerfile**, Dockerfile Location = `/Dockerfile`.
2. Домен: `https://img.weeb-x.com` (Coolify сам выпустит TLS через Traefik).
3. Переменные окружения:

   | Переменная | Значение | Фаза |
   |---|---|---|
   | `PORT` | `3100` | runtime |
   | `CORS_ORIGIN` | `https://weeb-x.com` (домен САЙТА) | runtime |

4. Проверка: `https://img.weeb-x.com/health` → `{"status":"ok", ...}`

## 2. Сайт (`weeb-x.com`)

1. В Coolify: Build Pack = **Dockerfile**, Dockerfile Location = `/Dockerfile.site`
   (либо Nixpacks — тогда переменные сборки передаются автоматически через env-file).
2. Домен: `https://weeb-x.com`.
3. Переменные окружения сайта:

   | Переменная | Значение | Нужна при сборке? | Где используется |
   |---|---|---|---|
   | `NEXT_PUBLIC_IMAGE_SERVER_URL` | `https://img.weeb-x.com` | **ДА (критично!)** | клиентский бандл: лоадер картинок, гача |
   | `IMAGE_SERVICE_URL` | `https://img.weeb-x.com` | нет (runtime) | сервер: редирект `/api/image-proxy` → сервис, письма, рефералки |
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | от Supabase | **да** | клиентский бандл |
   | `SUPABASE_SERVICE_ROLE_KEY` | секрет | нет | только runtime (не выносить в ARG!) |
   | `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | от PostHog | **да** | клиентский бандл |
   | `KODIK_API_TOKEN` и прочие токены | секреты | нет | только runtime |

### ⚠️ Главная ловушка: `NEXT_PUBLIC_*` — переменные СБОРКИ

`NEXT_PUBLIC_*` переменные Next.js **инлайнит в JS-бандл во время `next build`**.
Если задать их только в рантайме (или пересобрать образ из кэша со старыми
значениями), клиентский код их не увидит — там останется пустая строка.

Симптом (наблюдался 09.09.2026): баннер грузится через
`img.weeb-x.com/optimize?...` (серверная часть видит runtime-env), а карточки
аниме — через `weeb-x.com/_next/image?url=...`, который при кастомном лоадере
**не существует и отдаёт 404** → битые картинки.

Чеклист исправления:

1. В Coolify открыть переменные окружения сайта.
2. У `NEXT_PUBLIC_IMAGE_SERVER_URL` включить чекбокс **«Is build variable»**
   (и «Is runtime variable» — оставить включённым).
3. **Redeploy → Deploy without cache** (purge build cache), иначе Docker
   переиспользует старый слой `npm run build` со старым значением.
4. Проверить в браузере (Ctrl+U, исходный HTML): у постеров должен быть
   `https://img.weeb-x.com/optimize?url=...`, а не `/_next/image?url=...`.

### Резервный fallback

Лоадер (`lib/coolify-image-loader.js`) и гача (`app/gacha/utils.ts`) при
отсутствии `NEXT_PUBLIC_IMAGE_SERVER_URL` в бандле уходят на
`/api/image-proxy?url=...`, который на сервере 302-редиректит на image-service
через рантайм-переменную `IMAGE_SERVICE_URL`. Так картинки работают даже с
«незапечённой» сборкой (без оптимизации webp/resize). Fallback на
`/_next/image` запрещён — при `images.loader: 'custom'` Next.js этот эндпоинт
не отдаёт (404).

## 3. Быстрая диагностика

```bash
# Сервис жив?
curl https://img.weeb-x.com/health
# Оптимизация работает?
curl -o /dev/null -w "%{http_code} %{content_type}\n" \
  "https://img.weeb-x.com/optimize?url=https%3A%2F%2Fmedia.kitsu.app%2Fanime%2F50181%2Fposter_image%2F519b5f0a401c3363c9910b7a4560a2ac.jpg&w=384&q=60&f=webp"
# Прокси сайта работает и редиректит на сервис?
curl -sI "https://weeb-x.com/api/image-proxy?url=https%3A%2F%2Fmedia.kitsu.app%2Fanime%2F50181%2Fposter_image%2F519b5f0a401c3363c9910b7a4560a2ac.jpg" | head -5
```

В браузере: DevTools → Network → Img → смотреть, куда уходят запросы картинок
и какой код ответа (404 на `/_next/image` = переменная не попала в сборку).

## 4. Разрешённые хосты картинок

Image-service (`coolify-image-service/server.js`, `ALLOWED_HOSTS`) и сайт
(`app/api/image-proxy/route.ts`) проксируют только доверенные хосты. Kitsu
иногда отдаёт постеры как подписанные S3-ссылки
`kitsu-production-media.s3.us-west-002.backblazeb2.com` — хост добавлен в оба
списка. Если появится новый источник картинок — добавить в оба `ALLOWED_HOSTS`.
