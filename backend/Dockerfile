FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS development
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate --config prisma.config.ts
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

FROM base AS build
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY . .
RUN npx prisma generate --config prisma.config.ts && npm run build

FROM build AS migration
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:22-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/storage && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
