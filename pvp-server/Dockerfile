FROM node:22-alpine

WORKDIR /app

# curl нужен и для HEALTHCHECK ниже, и для healthcheck'а Coolify
RUN apk add --no-cache curl

COPY package.json package-lock.json ./
RUN (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund) \
    && npm cache clean --force

COPY server.js ./

# Smoke-тест на сборке: сервер обязан подняться и ответить /health
RUN sh -c 'SUPABASE_URL=https://smoke.invalid SUPABASE_SERVICE_KEY=smoke PORT=3101 node server.js > /tmp/smoke.log 2>&1 & \
pid=$!; sleep 3; \
if ! curl -fsS http://127.0.0.1:3101/health > /dev/null; then \
  echo "=== PvP server smoke test FAILED ==="; cat /tmp/smoke.log; kill $pid 2>/dev/null; exit 1; \
fi; \
echo "=== smoke test OK: $(curl -fsS http://127.0.0.1:3101/health) ==="; kill $pid 2>/dev/null'

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/health > /dev/null || exit 1

CMD ["node", "server.js"]
