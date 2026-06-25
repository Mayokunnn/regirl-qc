FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS build
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @regirl/db exec prisma generate --schema prisma/schema.prisma
RUN pnpm --filter @regirl/db run build
RUN pnpm --filter @regirl/ai run build
RUN pnpm --filter @regirl/config run build
RUN pnpm --filter @regirl/storage run build
RUN pnpm --filter @regirl/types run build
RUN pnpm --filter @regirl/api run build

EXPOSE 3000
CMD ["node", "apps/api/dist/apps/api/src/main"]
