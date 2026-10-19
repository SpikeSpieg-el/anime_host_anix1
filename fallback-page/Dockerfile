# Статичная заглушка Weebx: доступна только через прокси Coolify,
# когда основной сайт (Next.js) недоступен. См. docs/FALLBACK-PAGE-COOLIFY.md.
FROM nginx:alpine

# curl нужен и для HEALTHCHECK ниже, и для healthcheck'а Coolify
RUN apk add --no-cache curl

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY html/ /usr/share/nginx/html/
COPY fonts/ /usr/share/nginx/html/fonts/
COPY assets/ /usr/share/nginx/html/assets/

# Smoke-тест на сборке: конфиг должен быть валиден, страница и ассеты на месте.
RUN nginx -t \
  && test -f /usr/share/nginx/html/maintenance.html \
  && test -f /usr/share/nginx/html/fonts/Unbounded-Bold.woff2 \
  && test -f /usr/share/nginx/html/fonts/Inter-Regular.woff2 \
  && test -f /usr/share/nginx/html/fonts/JetBrainsMono-Medium.woff2 \
  && test -f /usr/share/nginx/html/assets/maintenance-girl.png

EXPOSE 8080

# Без -f: заглушка отвечает 503 на всё (это её работа), важно лишь, что nginx жив.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -s -o /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
