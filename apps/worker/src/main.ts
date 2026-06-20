import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import {
  averageConfidence,
  buildEvaluators,
  confidenceToFloat,
  deriveSessionVerdict,
  pickEvaluator,
  pickFallbackEvaluator,
  validatePhotos
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
  const normalized = v?.toLowerCase();
  if (normalized === 'pass') return Verdict.pass;
  if (normalized === 'fail') return Verdict.fail;
  if (normalized === 'advisory') return Verdict.advisory;
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
// Few-shot learning: turn human verdict corrections into per-criterion notes
// ---------------------------------------------------------------------------

/**
 * Builds a map of criterionKey -> human-readable correction notes, derived from
 * supervisor verdict ratings on past sessions for the same style. These notes
 * are injected into the AI prompt so the model learns from its mistakes.
 */
async function buildCorrectionNotes(styleId: string): Promise<Map<string, string>> {
  const corrections = await prisma.sessionCriterionResult.findMany({
    where: {
      verdictRating: 'wrong',
      correctedVerdict: { not: null },
      evaluation: { session: { styleId } }
    },
    select: { criterionKey: true, verdict: true, correctedVerdict: true, failureReason: true },
    orderBy: { verdictRatedAt: 'desc' },
    take: 300
  });

  const byKey = new Map<string, typeof corrections>();
  for (const c of corrections) {
    const list = byKey.get(c.criterionKey) ?? [];
    list.push(c);
    byKey.set(c.criterionKey, list);
  }

  const notes = new Map<string, string>();
  for (const [key, list] of byKey) {
    // AI said FAIL but the correct answer was PASS → over-failing (false positive)
    const falseFails = list.filter((c) => c.verdict === 'fail' && c.correctedVerdict === 'pass');
    // AI said PASS but the correct answer was FAIL → missed defect (false negative)
    const missedFails = list.filter((c) => c.verdict === 'pass' && c.correctedVerdict === 'fail');

    const lines: string[] = [];
    if (falseFails.length > 0) {
      const examples = falseFails
        .map((c) => c.failureReason)
        .filter((r): r is string => !!r)
        .slice(0, 3)
        .map((r) => `"${r}"`)
        .join('; ');
      lines.push(
        `Supervisors overturned ${falseFails.length} FALSE FAIL(s) on this criterion — you flagged a defect that was not actually there. Do not repeat these incorrect reasons: ${examples || '(no reason recorded)'}. Only FAIL when the submission is clearly worse than the reference.`
      );
    }
    if (missedFails.length > 0) {
      lines.push(
        `Supervisors caught ${missedFails.length} MISSED DEFECT(s) on this criterion — you passed something that should have failed. Look more carefully here.`
      );
    }
    if (lines.length > 0) notes.set(key, lines.join(' '));
  }

  return notes;
}

/**
 * Builds a style-level calibration note from supervisors' overall agree/disagree
 * feedback on past sessions of this style. We only act on the unambiguous signal:
 * a disagreement with a PASS/ADVISORY verdict means the model let a defective
 * submission through (too lenient). Disagreements with FAIL verdicts are skipped
 * because the direction is ambiguous (could mean "too strict" or "should have
 * failed harder") — the precise per-criterion corrections handle those instead.
 * Returns '' when there is no actionable signal.
 */
async function buildStyleStrictnessNote(styleId: string): Promise<string> {
  const tooLenient = await prisma.verdictFeedback.findMany({
    where: {
      agreed: false,
      session: { styleId, finalVerdict: { in: [Verdict.pass, Verdict.advisory] } }
    },
    select: { comment: true },
    orderBy: { createdAt: 'desc' },
    take: 200
  });

  if (tooLenient.length === 0) return '';

  const examples = tooLenient
    .map((f) => f.comment?.trim())
    .filter((c): c is string => !!c)
    .slice(0, 3)
    .map((c) => `"${c}"`)
    .join('; ');

  return `Supervisors disagreed with ${tooLenient.length} recent PASS/ADVISORY verdict(s) on this style — you have been TOO LENIENT and passed submissions that should have failed. Scrutinise every criterion more strictly and do not pass a submission unless it clearly matches the reference.${examples ? ` Supervisor notes: ${examples}.` : ''}`;
}

/**
 * Returns the angle keys that share an identical submission image with at least
 * one other angle (i.e. the same photo was used for multiple slots). Empty when
 * every angle has a distinct photo.
 */
function findDuplicateAngles(anglePayloads: AnglePayload[]): string[] {
  const byHash = new Map<string, string[]>();
  for (const a of anglePayloads) {
    const hash = createHash('sha256').update(a.submissionImageBase64).digest('hex');
    const list = byHash.get(hash) ?? [];
    list.push(a.angleKey);
    byHash.set(hash, list);
  }
  const dupes: string[] = [];
  for (const angles of byHash.values()) {
    if (angles.length > 1) dupes.push(...angles);
  }
  return dupes;
}

/**
 * Writes a NEEDS_REVIEW evaluation for a submission we refused to score (e.g.
 * duplicate photos). Surfaces a single explanatory criterion so the reason is
 * visible in the app, and routes the session to a human rather than emitting a
 * misleading PASS/FAIL.
 */
async function writeInvalidSubmission(
  sessionId: string,
  referenceSetVersion: number,
  message: string
): Promise<void> {
  const evaluation = await prisma.sessionEvaluation.create({
    data: {
      sessionId,
      provider: 'validation',
      fallbackUsed: false,
      overallVerdict: Verdict.needs_review,
      confidence: 0,
      reworkInstructions: message,
      promptVersion: 'validation',
      referenceSetVersion
    }
  });

  await prisma.sessionCriterionResult.create({
    data: {
      evaluationId: evaluation.id,
      criterionKey: 'photo-validation',
      verdict: Verdict.fail,
      confidence: 1,
      severity: Severity.major,
      failureReason: message,
      failureLocation: null,
      reworkInstruction: message
    }
  });

  await prisma.qcSession.update({
    where: { id: sessionId },
    data: {
      status: SessionStatus.completed,
      completedAt: new Date(),
      finalVerdict: Verdict.needs_review,
      finalReworkText: message,
      referenceVersionUsed: referenceSetVersion
    }
  });
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

    // Few-shot learning: gather human corrections of past verdicts for this style,
    // grouped per criterion, to inject into the prompt.
    const correctionNotesByCriterion = await buildCorrectionNotes(session.styleId);
    if (correctionNotesByCriterion.size > 0) {
      console.log(`[worker] loaded learned corrections for ${correctionNotesByCriterion.size} criteria`);
    }

    // Few-shot learning: style-level strictness calibration from overall feedback.
    const styleStrictnessNote = await buildStyleStrictnessNote(session.styleId);
    if (styleStrictnessNote) {
      console.log(`[worker] applying style strictness calibration: ${styleStrictnessNote.slice(0, 80)}…`);
    }

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
        evaluationType: (c.evaluationType ?? 'conformity') as EvaluationType,
        correctionNotes: correctionNotesByCriterion.get(c.key)
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

    // Guard: reject sessions where the same photo was dropped into more than one
    // angle slot. The LLM cannot reliably tell that a photo is the wrong shot for
    // its slot, so we catch the obvious case (identical bytes) deterministically
    // before spending an AI call — and surface a clear, honest reason.
    const duplicateAngles = findDuplicateAngles(anglePayloads);
    if (duplicateAngles.length > 0) {
      console.warn(`[worker] job ${job.id} — duplicate photos across angles: ${duplicateAngles.join(', ')}. Rejecting.`);
      await writeInvalidSubmission(
        session.id,
        activeReference.version,
        `The same photo was uploaded for multiple angles (${duplicateAngles.join(', ')}). Each capture angle needs its own distinct photo. Re-shoot each angle and resubmit.`
      );
      return;
    }

    // Guard: dedicated photo-validation pass — reject photos that are not a wig
    // or clearly show the wrong capture angle, before spending a full evaluation.
    const photoIssues = await validatePhotos(anglePayloads);
    if (photoIssues.length > 0) {
      const summary = photoIssues.map((i) => `${i.angleLabel}: ${i.problem}`).join('; ');
      console.warn(`[worker] job ${job.id} — photo validation failed: ${summary}. Rejecting.`);
      await writeInvalidSubmission(
        session.id,
        activeReference.version,
        `Some photos are not valid for their slot — ${summary}. Re-shoot the affected angles with the correct photo and resubmit.`
      );
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
      styleStrictnessNote,
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
