# Regirl QC Vision App - Backend MVP Architecture

## Runtime components
- `apps/api`: NestJS HTTP API with JWT auth, admin, sessions, and style endpoints.
- `apps/worker`: BullMQ worker for asynchronous session evaluation.
- `packages/db`: Prisma schema, migrations, seed data, and shared Prisma client.
- `packages/ai`: `VisionEvaluator` abstraction with `mock`, `gemini` stub, and `openai` stub providers.
- `packages/storage`: Storage abstraction for local filesystem and S3-compatible targets.

## Async flow
1. Draft session created.
2. Upload URL generated per angle and confirmed.
3. Submit validates required angles then enqueues BullMQ job.
4. Worker evaluates using selected provider (with fallback logic).
5. Immutable evaluation + criteria results persisted.

## Auditability
Each completed evaluation persists:
- `promptVersion`
- `referenceSetVersion`
- provider name and whether fallback was used.
