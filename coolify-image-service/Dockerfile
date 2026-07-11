FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

# Create cache directory
RUN mkdir -p /app/cache

EXPOSE 3100

ENV PORT=3100
ENV CORS_ORIGIN=https://weeb-x.com

CMD ["node", "server.js"]
