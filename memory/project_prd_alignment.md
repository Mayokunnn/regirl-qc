---
name: PRD Alignment — completed changes
description: What was built to align the codebase with the Regirl QC PRD v2.0, and what still needs doing
type: project
---

## What was built (PRD alignment session, 2026-05-16)

### Schema (packages/db/prisma/schema.prisma + migration 20260516000000_prd_alignment)
- `Verdict` enum: replaced `uncertain` → `advisory` + `needs_review`
- `Severity` enum: replaced `low/medium/high` → `major/minor`
- New `EvaluationType` enum: `conformity | proportional | positional | surface`
- `Style`: added `lengthInches`, `laceType`, `textureType`, `styleNuanceContext`
- `CaptureAngle`: added `supervisorInstruction`, `sortOrder`
- `Criterion`: added `description`, `acceptableStandard`, `severityIfFailed`, `evaluationType`, `sortOrder`
- New `CriterionAngle` junction table (criterion ↔ angleKey M:M)
- `ReferenceImage`: added `annotationNote` (critical for POSITIONAL/PROPORTIONAL ruler-based evaluation)
- `QcSession`: added `wigId`, `supervisorOverrideReason`, `supervisorOverrideAt`
- `SessionCriterionResult`: renamed `message` → `failureReason` (nullable), added `reworkInstruction` (nullable), made `severity` nullable

### Types (packages/types/src/index.ts)
- Updated all enums to match schema
- `AnglePayload` now carries: `submissionImageBase64`, `referenceImagesBase64[]`, `referenceAnnotationNotes[]`, `criteria[]` (full CriterionPayload)
- `SessionPayload` now carries: `styleNuanceContext`, `wigId`, `referenceSetVersion: number`
- `EvaluationCriterionResult.confidence` is now `ConfidenceLevel` ('HIGH'|'MEDIUM'|'LOW')

### AI package (packages/ai/src/index.ts)
- Added `@google/generative-ai` and `openai` npm packages
- Gemini evaluator: real API call per angle, uses PRD §8.3 prompt template with style nuance context, reference images as base64 inlineData, returns structured JSON
- OpenAI evaluator: GPT-4o fallback, same prompt structure, image_url with base64
- Mock evaluator: uses criterion metadata (severityIfFailed from payload) for deterministic results
- Verdict derivation follows PRD §8.4: FAIL (any MAJOR) > NEEDS_REVIEW (any LOW confidence) > ADVISORY (only MINOR fails) > PASS
- Fallback logic: per-criterion LOW-confidence triggers GPT-4o re-evaluation; best confidence answer wins per criterion

### Worker (apps/worker/src/main.ts)
- Loads full context: style.styleNuanceContext, criteria with relevantAngles, reference images with annotationNote
- Builds per-angle payload (PRD §8.2): only criteria relevant to each angle, reference images encoded to base64
- Handles fallback merge: per-criterion override for LOW confidence results
- Correct Prisma enum mapping for new Verdict/Severity values

### Sessions API
- `POST /sessions`: now requires `wigId` in body
- `GET /sessions` list: returns `wigId` and `skuName` in each item
- `POST /sessions/:id/override`: new endpoint — supervisor approves ADVISORY verdict with written reason; sets `finalVerdict → pass` and records override reason/timestamp

### Seed (packages/db/prisma/seed.ts)
- Soft Siren: full PRD §9.3 angles (7), PRD §9.4 criteria (12) with all metadata
- SKUs: `SS-NAT-001` (Natural Color with Dark Cherry Tones), `SS-DC-001` (Dark Cherry)
- Style: length 22", T-Closure lace, Light-Yaki texture, full §9.2 nuance context seeded
- Reference images: placeholder records with annotation notes — must be replaced with real photos via admin panel before live QC

## What's NOT done yet
- Admin panel (explicitly deferred)
- Real Gemini/OpenAI image calls only work once `GEMINI_API_KEY` / `OPENAI_API_KEY` are set in `.env`
- Reference images are placeholders — must upload real Soft Siren gold-standard photos

**Why:** PRD alignment session — full backend now matches PRD v2.0 spec for Soft Siren pilot.
**How to apply:** When adding new styles, use the seed pattern (add to SOFT_SIREN_CRITERIA/ANGLES arrays with a new style code). When implementing admin panel, it needs to manage ReferenceImage records with annotationNote and ReferenceSet versioning.
