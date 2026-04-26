# Regirl QC Vision App - Backend MVP Monorepo

Production-structured backend-first TypeScript monorepo with a fully functional mock AI path (no external AI keys required).

## Stack
- pnpm workspaces + Turborepo
- NestJS API + BullMQ worker
- PostgreSQL + Prisma
- Redis queue
- S3-compatible storage with local fallback
- JWT auth (`supervisor`, `admin`)

## Quickstart
1. `cp .env.example .env`
2. `docker compose -f infra/docker/docker-compose.yml up -d`
3. `pnpm install`
4. `pnpm db:migrate`
5. `pnpm db:seed`
6. `pnpm dev`

## Commands
- `pnpm dev`
- `pnpm test`
- `pnpm db:migrate`
- `pnpm db:seed`

## Default seed credentials
- `admin@regirl.local` / `password123`
- `supervisor@regirl.local` / `password123`

## AI provider selection
Set `AI_PROVIDER=mock|gemini|openai|auto`.
If selected provider is unavailable (missing key), service gracefully falls back to `mock`.

See `docs/architecture.md` and `docs/api-examples.md`.
