import { readFile } from 'node:fs/promises';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import {
  averageConfidence,
  buildEvaluators,
  confidenceToFloat,
  deriveSessionVerdict,
  pickEvaluator,
  pickFallbackEvaluator
} from '@regirl/ai';
import { getEnv } from '@regirl/config';
import { PrismaClient, SessionStatus, Verdict, Severity } from '@regirl/db';
import { getStorage } from '@regirl/storage';
import {
  AnglePayload,
  CriterionPayload,
  EvaluationCriterionResult,
  EvaluationType,
  SessionPayload,
  Severity as TypesSeverity
} from '@regirl/types';

const env = getEnv();
const prisma = new PrismaClient();
const storage = getStorage();
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

async function resolveImageBase64(objectKey: string): Promise<string> {
  const url = await storage.createReadUrl(objectKey);
  if (url.startsWith('file://')) {
    const data = await readFile(url.replace('file://', ''));
    return `data:image/jpeg;base64,${data.toString('base64')}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image ${objectKey}: ${res.status}`);
  const buf = await res.arrayBuffer();
  return `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`;
}

// ---------------------------------------------------------------------------
// Verdict / severity mapping to Prisma enums
// ---------------------------------------------------------------------------

function toDbVerdict(v: string): Verdict {
  if (v === 'pass') return Verdict.pass;
  if (v === 'fail') return Verdict.fail;
  if (v === 'advisory') return Verdict.advisory;
  return Verdict.needs_review;
}

function toDbSeverity(s: string | null): Severity | null {
  if (s === 'major') return Severity.major;
  if (s === 'minor') return Severity.minor;
  return null;
}

// ---------------------------------------------------------------------------
// Build rework summary from criteria results
// ---------------------------------------------------------------------------

function buildReworkSummary(criteria: EvaluationCriterionResult[]): string {
  const failures = criteria.filter((c) => c.verdict === 'FAIL');
  if (failures.length === 0) return 'No rework required. All criteria passed.';
  return failures
    .map((c) => `[${c.severity?.toUpperCase() ?? 'MINOR'}] ${c.criterionKey}: ${c.reworkInstruction ?? c.failureReason ?? 'Inspect and correct.'}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

const worker = new Worker(
  'session-evaluation',
  async (job: Job<{ sessionId: string }>) => {
    const { sessionId } = job.data;
    console.log(`[worker] job ${job.id} — evaluating sessionId=${sessionId}`);

    const session = await prisma.qcSession.findUnique({
      where: { id: sessionId },
      include: {
        sku: true,
        style: true,
        angleUploads: {
          include: { angle: true },
          where: { uploadedAt: { not: null } }
        }
      }
    });

    if (!session) {
      console.warn(`[worker] job ${job.id} — session ${sessionId} not found, skipping`);
      return;
    }

    console.log(`[worker] session found — styleId=${session.styleId} skuId=${session.skuId} angleUploads=${session.angleUploads.length}`);

    await prisma.qcSession.update({
      where: { id: session.id },
      data: { status: SessionStatus.processing }
    });

    // Active reference set with all its images
    const activeReference = await prisma.referenceSet.findFirst({
      where: { styleId: session.styleId, isActive: true },
      include: { images: true },
      orderBy: { version: 'desc' }
    });

    if (!activeReference) {
      console.error(`[worker] job ${job.id} — NO ACTIVE REFERENCE SET found for styleId=${session.styleId}. Cannot evaluate. Session marked failed.`);
      await prisma.qcSession.update({ where: { id: session.id }, data: { status: SessionStatus.failed } });
      return;
    }

    console.log(`[worker] using referenceSet id=${activeReference.id} version=${activeReference.version} images=${activeReference.images.length}`);

    // All criteria with their angle associations
    const allCriteria = await prisma.criterion.findMany({
      include: { relevantAngles: true },
      orderBy: { sortOrder: 'asc' }
    });

    console.log(`[worker] loaded ${allCriteria.length} criteria from DB`);

    // Build per-angle payloads (PRD §8.2)
    const anglePayloads: AnglePayload[] = [];

    for (const upload of session.angleUploads) {
      const angleKey = upload.angle.key;

      // Only include criteria that list this angle as relevant
      const angleCriteria = allCriteria.filter((c) =>
        c.relevantAngles.some((ra) => ra.angleKey === angleKey)
      );
      if (angleCriteria.length === 0) {
        console.warn(`[worker] angle=${angleKey} has no relevant criteria — skipping`);
        continue;
      }

      console.log(`[worker] angle=${angleKey} matched ${angleCriteria.length} criteria`);

      const criterionPayloads: CriterionPayload[] = angleCriteria.map((c) => ({
        key: c.key,
        label: c.label,
        description: c.description ?? '',
        acceptableStandard: c.acceptableStandard ?? '',
        severityIfFailed: (c.severityIfFailed ?? 'minor') as TypesSeverity,
        evaluationType: (c.evaluationType ?? 'conformity') as EvaluationType
      }));

      // Reference images for this angle (with annotation notes)
      const refImages = activeReference.images.filter((img) => img.angleKey === angleKey);
      console.log(`[worker] angle=${angleKey} has ${refImages.length} reference images`);
      const refImagesBase64: string[] = [];
      const refAnnotations: string[] = [];

      for (const img of refImages) {
        try {
          refImagesBase64.push(await resolveImageBase64(img.objectKey));
          refAnnotations.push(img.annotationNote ?? 'No annotation provided.');
        } catch (err) {
          console.warn(`[worker] failed to load reference image for angle=${angleKey} key=${img.objectKey}:`, err instanceof Error ? err.message : err);
        }
      }

      // Submission image — required; skip angle on failure
      let submissionBase64: string;
      try {
        submissionBase64 = await resolveImageBase64(upload.objectKey);
        console.log(`[worker] submission image loaded for angle=${angleKey}`);
      } catch (err) {
        console.error(`[worker] FAILED to load submission image for angle=${angleKey} key=${upload.objectKey}:`, err instanceof Error ? err.message : err);
        continue;
      }

      anglePayloads.push({
        angleKey,
        angleLabel: upload.angle.label,
        supervisorInstruction: upload.angle.supervisorInstruction ?? '',
        submissionImageBase64: submissionBase64,
        referenceImagesBase64: refImagesBase64,
        referenceAnnotationNotes: refAnnotations,
        criteria: criterionPayloads
      });
    }

    if (anglePayloads.length === 0) {
      console.error(`[worker] job ${job.id} — NO angle payloads built (uploaded angles had no matching criteria or images failed to load). Session marked failed.`);
      await prisma.qcSession.update({ where: { id: session.id }, data: { status: SessionStatus.failed } });
      return;
    }

    console.log(`[worker] built ${anglePayloads.length} angle payloads — sending to AI evaluator`);

    const sessionPayload: SessionPayload = {
      sessionId: session.id,
      skuCode: session.sku.code,
      styleName: session.style.name,
      styleNuanceContext: session.style.styleNuanceContext ?? '',
      stylistName: session.stylistName,
      wigId: session.wigId,
      angles: anglePayloads,
      referenceSetVersion: activeReference.version,
      promptVersion: activeReference.promptVersion
    };

    // Primary evaluation
    const primary = pickEvaluator();
    console.log(`[worker] using primary evaluator: ${primary.providerName}`);
    let result = await primary.evaluateSession(sessionPayload);
    console.log(`[worker] primary evaluation done — verdict=${result.verdict} criteria=${result.criteria.length} lowConfidence=${result.criteria.filter(c => c.confidence === 'LOW').length}`);

    // Fallback for LOW-confidence criteria (PRD §2: GPT-4o for low-confidence results)
    if (result.criteria.some((c) => c.confidence === 'LOW')) {
      const fallback = pickFallbackEvaluator(primary.providerName);
      if (fallback) {
        console.log(`[worker] running fallback evaluator: ${fallback.providerName}`);
        try {
          const fallbackResult = await fallback.evaluateSession(sessionPayload);

          // Merge: for each criterion that was LOW confidence, prefer the fallback
          // answer if it came back with higher confidence
          const mergedCriteria: EvaluationCriterionResult[] = result.criteria.map((pc) => {
            if (pc.confidence !== 'LOW') return pc;
            const fb = fallbackResult.criteria.find((f) => f.criterionKey === pc.criterionKey);
            return fb && confidenceToFloat(fb.confidence) > confidenceToFloat(pc.confidence) ? fb : pc;
          });

          const mergedVerdict = deriveSessionVerdict(mergedCriteria);
          result = {
            ...result,
            verdict: mergedVerdict,
            criteria: mergedCriteria,
            reworkInstructions: buildReworkSummary(mergedCriteria),
            fallbackUsed: true
          };
          console.log(`[worker] fallback merge done — final verdict=${result.verdict}`);
        } catch (err) {
          console.warn(`[worker] fallback evaluator failed, keeping primary result:`, err instanceof Error ? err.message : err);
        }
      }
    }

    const overallConfidence = averageConfidence(result.criteria);
    console.log(`[worker] writing evaluation to DB — verdict=${result.verdict} confidence=${overallConfidence.toFixed(2)}`);

    const createdEvaluation = await prisma.sessionEvaluation.create({
      data: {
        sessionId: session.id,
        provider: result.provider,
        fallbackUsed: result.fallbackUsed,
        overallVerdict: toDbVerdict(result.verdict),
        confidence: overallConfidence,
        reworkInstructions: result.reworkInstructions,
        promptVersion: result.promptVersion,
        referenceSetVersion: result.referenceSetVersion
      }
    });

    await prisma.sessionCriterionResult.createMany({
      data: result.criteria.map((c) => ({
        evaluationId: createdEvaluation.id,
        criterionKey: c.criterionKey,
        verdict: toDbVerdict(c.verdict),
        confidence: confidenceToFloat(c.confidence),
        severity: toDbSeverity(c.severity),
        failureReason: c.failureReason,
        failureLocation: c.failureLocation ?? null,
        reworkInstruction: c.reworkInstruction
      }))
    });

    await prisma.qcSession.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.completed,
        completedAt: new Date(),
        finalVerdict: toDbVerdict(result.verdict),
        finalReworkText: result.reworkInstructions,
        promptVersionUsed: result.promptVersion,
        referenceVersionUsed: result.referenceSetVersion
      }
    });
    console.log(`[worker] job ${job.id} — session ${sessionId} completed with verdict=${result.verdict}`);
  },
  { connection, concurrency: env.WORKER_CONCURRENCY }
);

worker.on('completed', (job) => {
  // eslint-disable-next-line no-console
  console.log(`Session evaluation completed: job ${job.id}`);
});

worker.on('failed', (job, error) => {
  // eslint-disable-next-line no-console
  console.error(`Session evaluation failed: job ${job?.id}`, error);
});

// eslint-disable-next-line no-console
console.log('Regirl worker started.');
