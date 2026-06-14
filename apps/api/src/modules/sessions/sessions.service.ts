import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { SessionStatus, Verdict } from '@regirl/db';
import { getStorage } from '@regirl/storage';
import { PrismaService } from '../../common/prisma.service';
import { QueueService } from '../../common/queue.service';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly storage = getStorage();

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService
  ) {}

  async createDraftSession(payload: {
    styleId: string;
    skuId: string;
    wigId: string;
    stylistName: string;
    userId: string;
  }) {
    return this.prisma.qcSession.create({
      data: {
        styleId: payload.styleId,
        skuId: payload.skuId,
        wigId: payload.wigId,
        stylistName: payload.stylistName,
        createdByUserId: payload.userId,
        status: SessionStatus.draft
      }
    });
  }

  async getSessions(query: { from?: Date; to?: Date; page: number; limit: number }) {
    const now = new Date();
    const from = query.from ?? new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const to = query.to ?? now;
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      this.prisma.qcSession.findMany({
        where: { createdAt: { gte: from, lte: to }, deletedAt: null },
        include: { sku: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit
      }),
      this.prisma.qcSession.count({ where: { createdAt: { gte: from, lte: to }, deletedAt: null } })
    ]);

    return {
      total,
      page: query.page,
      limit: query.limit,
      items: items.map((item) => ({
        id: item.id,
        sku: item.sku.code,
        skuName: item.sku.name,
        wigId: item.wigId,
        stylistName: item.stylistName,
        verdict: item.finalVerdict,
        status: item.status,
        supervisorOverrideReason: item.supervisorOverrideReason,
        createdAt: item.createdAt,
        submittedAt: item.submittedAt,
        completedAt: item.completedAt
      }))
    };
  }

  async getSessionDetail(sessionId: string) {
    const session = await this.prisma.qcSession.findUnique({
      where: { id: sessionId },
      include: {
        sku: true,
        style: true,
        angleUploads: { include: { angle: true } },
        evaluations: {
          include: { criteria: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!session) throw new NotFoundException('Session not found');

    const angleImages = await Promise.all(
      session.angleUploads.map(async (upload) => ({
        angleKey: upload.angle.key,
        angleLabel: upload.angle.label,
        uploadedAt: upload.uploadedAt,
        url: await this.storage.createReadUrl(upload.objectKey)
      }))
    );

    return { ...session, angleImages };
  }

  async requestUploadUrl(sessionId: string, angleKey: string) {
    const [session, angle] = await Promise.all([
      this.prisma.qcSession.findUnique({ where: { id: sessionId } }),
      this.prisma.captureAngle.findUnique({ where: { key: angleKey } })
    ]);

    if (!session) throw new NotFoundException('Session not found');
    if (!angle) throw new NotFoundException('Angle not found');
    if (session.status !== SessionStatus.draft) throw new BadRequestException('Session is not in draft state');

    const { objectKey, uploadUrl } = await this.storage.createUploadUrl(`sessions/${sessionId}/${angleKey}`);

    await this.prisma.sessionAngleUpload.upsert({
      where: { sessionId_angleId: { sessionId, angleId: angle.id } },
      update: { objectKey },
      create: { sessionId, angleId: angle.id, objectKey }
    });

    return { objectKey, uploadUrl };
  }

  async uploadAngleFile(sessionId: string, angleKey: string, buffer: Buffer) {
    this.logger.log(`uploadAngleFile called — sessionId=${sessionId} angleKey=${angleKey} bufferBytes=${buffer.length}`);

    const [session, angle] = await Promise.all([
      this.prisma.qcSession.findUnique({ where: { id: sessionId } }),
      this.prisma.captureAngle.findUnique({ where: { key: angleKey } })
    ]);

    if (!session) {
      this.logger.warn(`uploadAngleFile — session not found: ${sessionId}`);
      throw new NotFoundException('Session not found');
    }
    if (!angle) {
      this.logger.warn(`uploadAngleFile — angle not found: ${angleKey}`);
      throw new NotFoundException('Angle not found');
    }
    if (session.status !== SessionStatus.draft) {
      this.logger.warn(`uploadAngleFile — session ${sessionId} status=${session.status}, expected draft`);
      throw new BadRequestException('Session is not in draft state');
    }

    const objectKey = `sessions/${sessionId}/${angleKey}/${randomUUID()}.jpg`;
    this.logger.log(`uploadAngleFile — storing object at key=${objectKey}`);
    try {
      await this.storage.putObject(objectKey, buffer);
    } catch (err) {
      this.logger.error(`uploadAngleFile — storage.putObject FAILED for key=${objectKey}`, err instanceof Error ? err.stack : String(err));
      throw err;
    }
    this.logger.log(`uploadAngleFile — storage write OK, upserting DB record`);

    const record = await this.prisma.sessionAngleUpload.upsert({
      where: { sessionId_angleId: { sessionId, angleId: angle.id } },
      update: { objectKey, uploadedAt: new Date() },
      create: { sessionId, angleId: angle.id, objectKey, uploadedAt: new Date() }
    });
    this.logger.log(`uploadAngleFile — SUCCESS uploadId=${record.id} sessionId=${sessionId} angleKey=${angleKey}`);
    return record;
  }

  async confirmUpload(sessionId: string, angleKey: string, objectKey: string) {
    const angle = await this.prisma.captureAngle.findUnique({ where: { key: angleKey } });
    if (!angle) throw new NotFoundException('Angle not found');

    const upload = await this.prisma.sessionAngleUpload.findUnique({
      where: { sessionId_angleId: { sessionId, angleId: angle.id } }
    });

    if (!upload || upload.objectKey !== objectKey) throw new BadRequestException('Upload mismatch');

    return this.prisma.sessionAngleUpload.update({
      where: { id: upload.id },
      data: { uploadedAt: new Date() }
    });
  }

  async submit(sessionId: string) {
    const session = await this.prisma.qcSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== SessionStatus.draft) throw new BadRequestException('Session must be draft before submission');

    const [requiredAngles, uploads] = await Promise.all([
      this.prisma.captureAngle.findMany({ where: { isRequired: true } }),
      this.prisma.sessionAngleUpload.findMany({
        where: { sessionId, uploadedAt: { not: null } },
        include: { angle: true }
      })
    ]);

    const uploadedKeys = new Set(uploads.map((u) => u.angle.key));
    const missing = requiredAngles.filter((a) => !uploadedKeys.has(a.key)).map((a) => a.key);

    if (missing.length > 0) {
      throw new BadRequestException(`Missing required angle uploads: ${missing.join(', ')}`);
    }

    await this.prisma.qcSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.submitted, submittedAt: new Date() }
    });

    await this.queueService.enqueueSessionEvaluation(sessionId);
    return { queued: true };
  }

  async getStatus(sessionId: string) {
    const session = await this.prisma.qcSession.findUnique({
      where: { id: sessionId },
      include: { evaluations: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    if (!session) throw new NotFoundException('Session not found');

    return {
      id: session.id,
      status: session.status,
      verdict: session.finalVerdict,
      supervisorOverrideReason: session.supervisorOverrideReason,
      completedAt: session.completedAt,
      latestEvaluation: session.evaluations[0] ?? null
    };
  }

  /** Supervisor approves an ADVISORY verdict with a written reason (PRD §8.4) */
  async supervisorOverride(sessionId: string, payload: { userId: string; reason: string }) {
    const session = await this.prisma.qcSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.finalVerdict !== Verdict.advisory) {
      throw new BadRequestException('Override is only allowed for sessions with an ADVISORY verdict');
    }
    if (!payload.reason.trim()) throw new BadRequestException('Override reason cannot be empty');

    return this.prisma.qcSession.update({
      where: { id: sessionId },
      data: {
        finalVerdict: Verdict.pass,
        supervisorOverrideReason: payload.reason.trim(),
        supervisorOverrideAt: new Date()
      }
    });
  }

  async saveReworkFeedback(sessionId: string, payload: { userId: string; helpful: boolean; comment?: string }) {
    return this.prisma.reworkFeedback.create({
      data: {
        sessionId,
        userId: payload.userId,
        helpful: payload.helpful,
        comment: payload.comment
      }
    });
  }

  async rateCriterion(criterionResultId: string, rating: 'helpful' | 'not_helpful') {
    const record = await this.prisma.sessionCriterionResult.findUnique({
      where: { id: criterionResultId }
    });
    if (!record) throw new NotFoundException('Criterion result not found');

    return this.prisma.sessionCriterionResult.update({
      where: { id: criterionResultId },
      data: { instructionRating: rating }
    });
  }
}
