# Stage 1: Dependencies, Prisma Client Generation & NestJS Build
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev && npm install --no-save prisma@^6.4.0 ts-node@^10.9.2 typescript@^5.7.3

# Stage 2: Minimal Non-Root Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3000

CMD ["npm", "run", "start:prod"]
