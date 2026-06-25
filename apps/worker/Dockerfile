FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter @regirl/db exec prisma generate --schema prisma/schema.prisma
RUN pnpm --filter @regirl/db run build
RUN pnpm --filter @regirl/ai run build
RUN pnpm --filter @regirl/config run build
RUN pnpm --filter @regirl/storage run build
RUN pnpm --filter @regirl/types run build
RUN pnpm --filter @regirl/worker run build

CMD ["node", "apps/worker/dist/main.js"]
