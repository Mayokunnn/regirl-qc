import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { pickEvaluator, pickFallbackEvaluator } from '@regirl/ai';
import { getEnv } from '@regirl/config';
import { PrismaClient, SessionStatus, Verdict } from '@regirl/db';

const env = getEnv();
const prisma = new PrismaClient();
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(
  'session-evaluation',
  async (job: Job<{ sessionId: string }>) => {
    const session = await prisma.qcSession.findUnique({
      where: { id: job.data.sessionId },
      include: {
        sku: true,
        style: true,
        angleUploads: { include: { angle: true }, where: { uploadedAt: { not: null } } }
      }
    });

    if (!session) {
      return;
    }

    await prisma.qcSession.update({ where: { id: session.id }, data: { status: SessionStatus.processing } });

    const activeReference = await prisma.referenceSet.findFirst({
      where: { styleId: session.styleId, isActive: true },
      orderBy: { version: 'desc' }
    });

    if (!activeReference) {
      await prisma.qcSession.update({ where: { id: session.id }, data: { status: SessionStatus.failed } });
      return;
    }

    const criteria = await prisma.criterion.findMany({ orderBy: { key: 'asc' } });
    const primary = pickEvaluator();

    const result = await primary.evaluateSession({
      sessionId: session.id,
      skuCode: session.sku.code,
      styleName: session.style.name,
      stylistName: session.stylistName,
      angles: session.angleUploads.map((item) => ({ angleKey: item.angle.key, imageObjectKey: item.objectKey })),
      criteriaKeys: criteria.map((item) => item.key),
      referenceSetVersion: String(activeReference.version),
      promptVersion: activeReference.promptVersion
    });

    let finalResult = result;
    if (result.confidence < 0.55) {
      const fallback = pickFallbackEvaluator(primary.providerName);
      if (fallback) {
        const fallbackResult = await fallback.evaluateSession({
          sessionId: session.id,
          skuCode: session.sku.code,
          styleName: session.style.name,
          stylistName: session.stylistName,
          angles: session.angleUploads.map((item) => ({ angleKey: item.angle.key, imageObjectKey: item.objectKey })),
          criteriaKeys: criteria.map((item) => item.key),
          referenceSetVersion: String(activeReference.version),
          promptVersion: activeReference.promptVersion
        });

        if (fallbackResult.confidence > result.confidence) {
          finalResult = { ...fallbackResult, fallbackUsed: true };
        }
      }
    }

    const createdEvaluation = await prisma.sessionEvaluation.create({
      data: {
        sessionId: session.id,
        provider: finalResult.provider,
        fallbackUsed: finalResult.fallbackUsed,
        overallVerdict:
          finalResult.verdict === 'pass' ? Verdict.pass : finalResult.verdict === 'fail' ? Verdict.fail : Verdict.uncertain,
        confidence: finalResult.confidence,
        reworkInstructions: finalResult.reworkInstructions,
        promptVersion: finalResult.promptVersion,
        referenceSetVersion: Number(finalResult.referenceSetVersion)
      }
    });

    await prisma.sessionCriterionResult.createMany({
      data: finalResult.criteria.map((item) => ({
        evaluationId: createdEvaluation.id,
        criterionKey: item.criterionKey,
        verdict: item.verdict === 'pass' ? Verdict.pass : item.verdict === 'fail' ? Verdict.fail : Verdict.uncertain,
        confidence: item.confidence,
        severity: item.severity,
        message: item.message
      }))
    });

    await prisma.qcSession.update({
      where: { id: session.id },
      data: {
        status: SessionStatus.completed,
        completedAt: new Date(),
        finalVerdict:
          finalResult.verdict === 'pass' ? Verdict.pass : finalResult.verdict === 'fail' ? Verdict.fail : Verdict.uncertain,
        finalReworkText: finalResult.reworkInstructions,
        promptVersionUsed: finalResult.promptVersion,
        referenceVersionUsed: Number(finalResult.referenceSetVersion)
      }
    });
  },
  { connection, concurrency: env.WORKER_CONCURRENCY }
);

worker.on('completed', (job) => {
  // eslint-disable-next-line no-console
  console.log(`Session evaluation completed for job ${job.id}`);
});

worker.on('failed', (job, error) => {
  // eslint-disable-next-line no-console
  console.error(`Session evaluation failed for job ${job?.id}`, error);
});

// eslint-disable-next-line no-console
console.log('Regirl worker started.');
