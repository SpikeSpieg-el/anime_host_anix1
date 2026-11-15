FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY telegram-bot/ ./telegram-bot/
USER node
CMD ["node", "telegram-bot/index.mjs"]
