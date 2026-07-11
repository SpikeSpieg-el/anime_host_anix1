FROM node:20-slim

WORKDIR /app

COPY coolify-image-service/package.json coolify-image-service/package-lock.json* ./
RUN npm install --production

COPY coolify-image-service/ .

RUN mkdir -p /app/cache

EXPOSE 3100

ENV PORT=3100
ENV CORS_ORIGIN=https://weeb-x.com

CMD ["node", "server.js"]
