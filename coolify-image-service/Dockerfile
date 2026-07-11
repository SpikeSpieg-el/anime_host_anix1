FROM node:20-slim

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /app/cache

EXPOSE 3100

ENV PORT=3100
ENV CORS_ORIGIN=https://weeb-x.com
ENV MAX_CONCURRENT_FETCHES=20

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3100/health || exit 1

CMD ["node", "server.js"]
