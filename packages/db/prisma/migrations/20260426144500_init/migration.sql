-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('supervisor', 'admin');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('draft', 'submitted', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('pass', 'fail', 'uncertain');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Style" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Style_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sku" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptureAngle" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptureAngle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Criterion" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Criterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceSet" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "promptVersion" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceImage" (
    "id" TEXT NOT NULL,
    "referenceSetId" TEXT NOT NULL,
    "angleKey" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcSession" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "stylistName" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "finalVerdict" "Verdict",
    "finalReworkText" TEXT,
    "promptVersionUsed" TEXT,
    "referenceVersionUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "QcSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionAngleUpload" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "angleId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionAngleUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEvaluation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "overallVerdict" "Verdict" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reworkInstructions" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "referenceSetVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCriterionResult" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criterionKey" TEXT NOT NULL,
    "verdict" "Verdict" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "severity" "Severity" NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "SessionCriterionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReworkFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReworkFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Style_code_key" ON "Style"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_code_key" ON "Sku"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureAngle_key_key" ON "CaptureAngle"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Criterion_key_key" ON "Criterion"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceSet_styleId_version_key" ON "ReferenceSet"("styleId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAngleUpload_sessionId_angleId_key" ON "SessionAngleUpload"("sessionId", "angleId");

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceSet" ADD CONSTRAINT "ReferenceSet_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceImage" ADD CONSTRAINT "ReferenceImage_referenceSetId_fkey" FOREIGN KEY ("referenceSetId") REFERENCES "ReferenceSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcSession" ADD CONSTRAINT "QcSession_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcSession" ADD CONSTRAINT "QcSession_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QcSession" ADD CONSTRAINT "QcSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAngleUpload" ADD CONSTRAINT "SessionAngleUpload_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QcSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAngleUpload" ADD CONSTRAINT "SessionAngleUpload_angleId_fkey" FOREIGN KEY ("angleId") REFERENCES "CaptureAngle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvaluation" ADD CONSTRAINT "SessionEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QcSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCriterionResult" ADD CONSTRAINT "SessionCriterionResult_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "SessionEvaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReworkFeedback" ADD CONSTRAINT "ReworkFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "QcSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

