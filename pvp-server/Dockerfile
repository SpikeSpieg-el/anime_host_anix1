FROM node:20-alpine

WORKDIR /app

# Зависимости отдельно, чтобы кэшировать слой
COPY package.json package-lock.json ./
# npm ci по закоммиченному lock-файлу; если лока нет — падаем на обычный install
RUN (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund) \
    && npm cache clean --force

COPY server.js ./

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

# busybox wget есть в алпине — curl ставить не нужно
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health > /dev/null || exit 1

CMD ["node", "server.js"]
