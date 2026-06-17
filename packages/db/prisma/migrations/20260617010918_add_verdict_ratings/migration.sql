-- AlterTable
ALTER TABLE "SessionCriterionResult" ADD COLUMN     "correctedVerdict" "Verdict",
ADD COLUMN     "verdictRatedAt" TIMESTAMP(3),
ADD COLUMN     "verdictRatedByUserId" TEXT,
ADD COLUMN     "verdictRating" TEXT;

-- CreateTable
CREATE TABLE "VerdictFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agreed" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerdictFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerdictFeedback_sessionId_idx" ON "VerdictFeedback"("sessionId");

-- CreateIndex
CREATE INDEX "SessionCriterionResult_criterionKey_verdictRating_idx" ON "SessionCriterionResult"("criterionKey", "verdictRating");

-- AddForeignKey
ALTER TABLE "VerdictFeedback" ADD CONSTRAINT "VerdictFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QcSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
