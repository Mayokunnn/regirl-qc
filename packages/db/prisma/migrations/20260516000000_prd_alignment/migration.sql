-- PRD Alignment Migration
-- Fixes verdict/severity enums, adds missing fields, adds CriterionAngle junction table

-- ============================================================
-- 1. Verdict enum: replace 'uncertain' with 'advisory' + 'needs_review'
-- ============================================================
CREATE TYPE "Verdict_new" AS ENUM ('pass', 'fail', 'advisory', 'needs_review');

ALTER TABLE "QcSession"
  ALTER COLUMN "finalVerdict" TYPE "Verdict_new"
  USING CASE "finalVerdict"::text
    WHEN 'pass'      THEN 'pass'::text
    WHEN 'fail'      THEN 'fail'::text
    WHEN 'uncertain' THEN 'needs_review'::text
    ELSE NULL
  END::"Verdict_new";

ALTER TABLE "SessionEvaluation"
  ALTER COLUMN "overallVerdict" TYPE "Verdict_new"
  USING CASE "overallVerdict"::text
    WHEN 'pass'      THEN 'pass'::text
    WHEN 'fail'      THEN 'fail'::text
    WHEN 'uncertain' THEN 'needs_review'::text
    ELSE 'needs_review'::text
  END::"Verdict_new";

ALTER TABLE "SessionCriterionResult"
  ALTER COLUMN "verdict" TYPE "Verdict_new"
  USING CASE "verdict"::text
    WHEN 'pass'      THEN 'pass'::text
    WHEN 'fail'      THEN 'fail'::text
    WHEN 'uncertain' THEN 'needs_review'::text
    ELSE 'needs_review'::text
  END::"Verdict_new";

DROP TYPE "Verdict";
ALTER TYPE "Verdict_new" RENAME TO "Verdict";

-- ============================================================
-- 2. Severity enum: replace 'low'/'medium'/'high' with 'major'/'minor'
-- ============================================================
CREATE TYPE "Severity_new" AS ENUM ('major', 'minor');

ALTER TABLE "SessionCriterionResult"
  ALTER COLUMN "severity" TYPE "Severity_new"
  USING CASE "severity"::text
    WHEN 'high' THEN 'major'::text
    ELSE 'minor'::text
  END::"Severity_new";

-- Severity is now nullable (null = criterion passed, no severity applies)
ALTER TABLE "SessionCriterionResult" ALTER COLUMN "severity" DROP NOT NULL;

DROP TYPE "Severity";
ALTER TYPE "Severity_new" RENAME TO "Severity";

-- ============================================================
-- 3. New EvaluationType enum
-- ============================================================
CREATE TYPE "EvaluationType" AS ENUM ('conformity', 'proportional', 'positional', 'surface');

-- ============================================================
-- 4. Style — add style-level fields needed for prompt construction
-- ============================================================
ALTER TABLE "Style" ADD COLUMN "lengthInches"       INTEGER;
ALTER TABLE "Style" ADD COLUMN "laceType"           TEXT;
ALTER TABLE "Style" ADD COLUMN "textureType"        TEXT;
ALTER TABLE "Style" ADD COLUMN "styleNuanceContext" TEXT;

-- ============================================================
-- 5. CaptureAngle — add supervisor instruction and sort order
-- ============================================================
ALTER TABLE "CaptureAngle" ADD COLUMN "supervisorInstruction" TEXT;
ALTER TABLE "CaptureAngle" ADD COLUMN "sortOrder"             INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- 6. Criterion — add full metadata required by the prompt
-- ============================================================
ALTER TABLE "Criterion" ADD COLUMN "description"        TEXT;
ALTER TABLE "Criterion" ADD COLUMN "acceptableStandard" TEXT;
ALTER TABLE "Criterion" ADD COLUMN "severityIfFailed"   "Severity";
ALTER TABLE "Criterion" ADD COLUMN "evaluationType"     "EvaluationType";
ALTER TABLE "Criterion" ADD COLUMN "sortOrder"          INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- 7. ReferenceImage — add ruler annotation note
-- ============================================================
ALTER TABLE "ReferenceImage" ADD COLUMN "annotationNote" TEXT;

-- ============================================================
-- 8. QcSession — add wigId and supervisor override fields
-- ============================================================
ALTER TABLE "QcSession" ADD COLUMN "wigId"                    TEXT NOT NULL DEFAULT '';
ALTER TABLE "QcSession" ADD COLUMN "supervisorOverrideReason" TEXT;
ALTER TABLE "QcSession" ADD COLUMN "supervisorOverrideAt"     TIMESTAMP(3);

-- ============================================================
-- 9. SessionCriterionResult — split 'message' into two fields
-- ============================================================
ALTER TABLE "SessionCriterionResult" RENAME COLUMN "message" TO "failureReason";
ALTER TABLE "SessionCriterionResult" ALTER COLUMN "failureReason" DROP NOT NULL;
ALTER TABLE "SessionCriterionResult" ADD COLUMN "reworkInstruction" TEXT;

-- ============================================================
-- 10. CriterionAngle — junction table (criterion ↔ capture angle)
-- ============================================================
CREATE TABLE "CriterionAngle" (
    "id"          TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "angleKey"    TEXT NOT NULL,
    CONSTRAINT "CriterionAngle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CriterionAngle_criterionId_angleKey_key"
    ON "CriterionAngle"("criterionId", "angleKey");

ALTER TABLE "CriterionAngle"
    ADD CONSTRAINT "CriterionAngle_criterionId_fkey"
    FOREIGN KEY ("criterionId") REFERENCES "Criterion"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
