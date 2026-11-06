# www.weeb-x.com: почему TLS падал и что сделать на сервере

Дата: 2026-11-06. Проблема из аудита: `https://www.weeb-x.com` отдавал
`TLSV1_ALERT_INTERNAL_ERROR` — в сертификате Let's Encrypt был только apex
(`SAN=[weeb-x.com]`). Любой переход по www (человек набрал домен с www,
краулер взял ссылку из каталога, ссылка из соцсетей) упирался в экран
недоверия браузера. Для сайта, который живёт трафиком из поиска, это
потерянные посетители и «недоступный сайт» в отчётах.

## Что уже сделано в коде

1. `middleware.ts` отдаёт **308** с `www.weeb-x.com` на apex, сохраняя путь и
   query. 308, а не 301: метод и тело POST не теряются.
   Хост берётся из `x-forwarded-host` → `host`, а не из `request.url`: за
   Caddy origin может быть внутренним (`http://localhost:3000`).
   Тесты: `tests/unit/middleware.test.ts`, блок «www → apex редирект».

2. `next.config.mjs` — комментарий-напоминание рядом с `headers()`.

## Что обязательно сделать на сервере (без этого редирект не сработает)

Редирект живёт в приложении, а падает соединение **до** приложения — на TLS.
Поэтому www нужно добавить в site-адреса Caddy, чтобы Let's Encrypt выпустил
сертификат с SAN `www.weeb-x.com`:

```caddyfile
weeb-x.com, www.weeb-x.com {
    encode zstd br gzip
    reverse_proxy 127.0.0.1:3000
}
```

Порядок:

```sh
# 1. Проверить, что www вообще резолвится в тот же IP
dig +short www.weeb-x.com

# 2. Обновить Caddyfile (см. выше) и применить
#    (для Coolify — поправить домены приложения и Redeploy)
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy

# 3. Убедиться, что в сертификате появился SAN с www
echo | openssl s_client -connect www.weeb-x.com:443 -servername www.weeb-x.com 2>/dev/null \
  | openssl x509 -noout -text | grep -A1 "Subject Alternative Name"

# 4. Проверить код ответа и адрес
curl -sI https://www.weeb-x.com/catalog | head -5
# ожидаем: HTTP/2 308 и location: https://weeb-x.com/catalog
```

Caddy выпускает сертификат на все имена из site-адреса автоматически, вручную
ничего заказывать не нужно. Если www проксируется через Cloudflare — сначала
убедитесь, что режим SSL «Full (strict)» и что оранжевое облако не отдаёт
свой сертификат вместо серверного.

## Заодно: сжатие

В аудите отдельным пунктом — «отдаётся только gzip». Это та же строка в
Caddyfile: `encode zstd br gzip`. Brotli на тексте даёт 15–20% экономии, а
ломать нечего: Next отдаёт обычные `text/html`/`application/javascript`.
