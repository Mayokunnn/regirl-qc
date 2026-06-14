# Regirl QC — MVP Gaps Design
**Date:** 2026-06-14  
**Scope:** Soft Siren pilot only  
**Approach:** Layer-by-layer — DB → AI → API → Frontend

---

## 1. Database Changes

Two nullable columns added to `SessionCriterionResult`:

```prisma
model SessionCriterionResult {
  // existing fields …
  failureLocation   String?  // 'front' | 'back' | 'ends' | 'lace' | 'crown' | 'left-side' | 'right-side'
  instructionRating String?  // 'helpful' | 'not_helpful' — filled on resubmission
}
```

Single Prisma migration (`add_criterion_location_and_rating`). No existing data affected.

The existing session-level `ReworkFeedback` model is kept as-is (supervisor override flow). The new `instructionRating` on each criterion replaces the per-criterion rating need.

---

## 2. AI / Prompt Changes

### 2a. Add `failure_location` to the JSON output schema

In `buildAnglePrompt` (`packages/ai/src/index.ts`), add `failure_location` to the per-criterion JSON spec:

```json
{
  "criterion_key": "string",
  "result": "PASS | FAIL",
  "confidence": "HIGH | MEDIUM | LOW",
  "failure_reason": "null or description",
  "failure_location": "null | 'front' | 'back' | 'ends' | 'lace' | 'crown' | 'left-side' | 'right-side'",
  "severity": "null | MAJOR | MINOR",
  "rework_instruction": "null or instruction"
}
```

Rule added: `failure_location must be null when result is PASS. When result is FAIL, return the area of the wig where the issue is located.`

The color-agnostic instruction is **already present** in the prompt (`Do NOT evaluate based on hair colour — colour variations are expected and intentional`). No change needed.

### 2b. Zod schema update

Add `failure_location: z.string().nullable()` to `CriterionResponseSchema`.

### 2c. Persistence

In the Gemini/GPT evaluator response mapping, map `failure_location` → `failureLocation` and include it when creating `SessionCriterionResult` records in the worker.

---

## 3. API Changes

### 3a. `GET /styles/:id/angles`

New endpoint on `StylesController`. Returns `CaptureAngle[]` for a given style (all angles are global for now — all styles share the same angle set in the seed, which is correct for Soft Siren).

```json
[
  { "key": "FRONT_FULL", "label": "Front Full", "supervisorInstruction": "…", "sortOrder": 0 },
  …
]
```

### 3b. Admin — reference image upload (angle-by-angle)

New flow in `AdminController`:

1. `POST /admin/reference-sets` (exists) — create a reference set for a style, returns `{ id }`
2. `POST /admin/reference-sets/:id/angles/:angleKey/upload` — accepts `{ data: base64, annotationNote: string }`, stores image via storage, creates `ReferenceImage` record
3. `POST /admin/reference-sets/:id/activate` (exists) — marks this set active, deactivates others for same style

### 3c. `GET /admin/reference-sets/:id/angles` 

Returns existing reference images for a set, grouped by angle key, with presigned read URLs. Used by the admin UI to show what's already uploaded per angle.

### 3d. `PATCH /sessions/evaluations/criteria/:criterionResultId/rating`

Saves `instructionRating` on a `SessionCriterionResult`. Called during the pre-session rating flow when the supervisor rates previous rework instructions before starting a resubmission.

Body: `{ rating: 'helpful' | 'not_helpful' }`  
Auth: JWT required, any role.

### 3e. `GET /sessions/:id` — include `failureLocation` and `instructionRating`

The existing detail endpoint already returns `criteria` from the latest evaluation. Extend the `SessionCriterionResult` mapping to include these two new fields.

---

## 4. Frontend Changes

### 4a. Auth context — expose user role

`AuthContext` currently stores `{ isAuthenticated, token, login, logout }`. Add `role: 'supervisor' | 'admin' | null` derived from the JWT payload (already returned by `/auth/login` as `user.role`).

### 4b. BottomNav — Admin tab

Add a third tab "Admin" between New Session and History, visible only when `role === 'admin'`. Routes to `/admin`.

Icon: a gear/settings icon.

### 4c. App routing — add admin routes

```
/admin                → AdminHomeScreen
/admin/reference      → AdminReferenceScreen
```

Both routes are accessible only when `role === 'admin'` (redirect to `/checklist` otherwise).

### 4d. `AdminHomeScreen`

Simple screen showing:
- Active reference set for Soft Siren (version number, created date, how many angles have images)
- "Manage Reference Images" button → `/admin/reference`
- "Create New Reference Set" button → creates a new draft set and navigates to `/admin/reference`

### 4e. `AdminReferenceScreen`

Angle-by-angle upload flow for a reference set.

**Layout:**
- Top: reference set version + "Activate" button (disabled until all 7 angles have at least 1 image)
- Angle list: 7 rows, one per angle. Each row shows:
  - Angle name + supervisor instruction
  - Thumbnail grid of uploaded images (up to 5)
  - "Add Photo" button (disabled at 5 images)
  - Annotation note text area (saves on blur)
- Bottom: "Activate Reference Set" CTA

**Upload flow per angle:**
1. Tap "Add Photo" → file picker (image/*)
2. Image converted to base64 → `POST /admin/reference-sets/:id/angles/:angleKey/upload`
3. Thumbnail appears immediately on success

### 4f. `PhotoUploadScreen` — dynamic angles

Replace hardcoded `CAPTURE_ANGLES` array with a fetch from `GET /styles/:styleId/angles` on mount (styleId comes from session context). The shape returned matches what's hardcoded today, so no other changes needed.

Cache the result in session context so it's not re-fetched on each render.

### 4g. Rating flow on resubmission

When the supervisor starts a **new session** (NewSessionScreen), after filling in the form:
- Check if there's a previous completed session for the same `wigId` that has a `FAIL` or `ADVISORY` verdict and has unrated criterion results (`instructionRating === null`)
- If yes: before navigating to `/upload`, navigate to `/rate-instructions` instead
- `/rate-instructions` shows the previous session's failed criteria with their rework instructions
- Each criterion has 👍 / 👎 buttons → calls `PATCH /sessions/evaluations/criteria/:id/rating`
- "Skip" and "Done" buttons both proceed to `/upload`

New screen: `RateInstructionsScreen`

### 4h. ResultsScreen — show failure location

On each failed criterion card, show a small location badge (e.g. "front", "ends") below the criterion name if `failureLocation` is non-null.

Existing `CriterionCard` component gets an optional `failureLocation` prop.

### 4i. HistoryScreen — show failure location

The expanded row already renders `CriterionCard` for each criterion via `mapSessionResult`. Pass `failureLocation` through `mapSessionResult` in `api.js` and display it the same way as 4h.

---

## 5. Data Flow Summary

```
Admin uploads reference → ReferenceSet + ReferenceImages (S3 + DB)
                               ↓
Supervisor starts session → picks SKU (existing), angles fetched from API
                               ↓
Supervisor uploads 7 photos → SessionAngleUpload records
                               ↓
Submit → worker fetches reference images, builds prompt, calls Gemini
       → stores SessionEvaluation + SessionCriterionResult (with failureLocation)
                               ↓
Results shown → failure location badge per criterion
                               ↓
Next resubmission → rating screen → instructionRating saved per criterion
```

---

## 6. Out of Scope

- Future styles (Sweet Siren, Spicy Icon etc.) — schema ready but no UI/seed
- Admin dashboard (pass rate, rework by stylist) — Phase 4
- Digital Ocean deploy / Metabase sync — separate infra task
- Wig ID format validation — pending stakeholder confirmation of format
