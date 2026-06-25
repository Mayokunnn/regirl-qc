FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter @regirl/db exec prisma generate --schema prisma/schema.prisma
RUN pnpm --filter @regirl/db run build
RUN pnpm --filter @regirl/ai run build
RUN pnpm --filter @regirl/config run build
RUN pnpm --filter @regirl/storage run build
RUN pnpm --filter @regirl/types run build
RUN pnpm --filter @regirl/api run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm
COPY --from=build /app/pnpm-workspace.yaml ./
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/packages/ ./packages/
COPY --from=build /app/apps/api/ ./apps/api/
RUN pnpm install --frozen-lockfile --prod
EXPOSE 3000
CMD ["node", "apps/api/dist/apps/api/src/main"]
