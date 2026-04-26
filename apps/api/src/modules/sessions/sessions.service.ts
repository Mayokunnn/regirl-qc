import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionStatus, Verdict } from '@regirl/db';
import { getStorage } from '@regirl/storage';
import { PrismaService } from '../../common/prisma.service';
import { QueueService } from '../../common/queue.service';

@Injectable()
export class SessionsService {
  private readonly storage = getStorage();

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService
  ) {}

  async createDraftSession(payload: { styleId: string; skuId: string; stylistName: string; userId: string }) {
    return this.prisma.qcSession.create({
      data: {
        styleId: payload.styleId,
        skuId: payload.skuId,
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
        stylistName: item.stylistName,
        verdict: item.finalVerdict,
        status: item.status,
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
        evaluations: { include: { criteria: true }, orderBy: { createdAt: 'desc' } }
      }
    });

    if (!session) throw new NotFoundException('Session not found');

    const angleImages = await Promise.all(
      session.angleUploads.map(async (angleUpload) => ({
        angleKey: angleUpload.angle.key,
        uploadedAt: angleUpload.uploadedAt,
        objectKey: angleUpload.objectKey,
        url: await this.storage.createReadUrl(angleUpload.objectKey)
      }))
    );

    return {
      ...session,
      angleImages
    };
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

  async confirmUpload(sessionId: string, angleKey: string, objectKey: string) {
    const angle = await this.prisma.captureAngle.findUnique({ where: { key: angleKey } });
    if (!angle) throw new NotFoundException('Angle not found');

    const upload = await this.prisma.sessionAngleUpload.findUnique({
      where: { sessionId_angleId: { sessionId, angleId: angle.id } }
    });

    if (!upload || upload.objectKey !== objectKey) {
      throw new BadRequestException('Upload mismatch');
    }

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

    const uploadedKeys = new Set(uploads.map((item) => item.angle.key));
    const missing = requiredAngles.filter((angle) => !uploadedKeys.has(angle.key)).map((angle) => angle.key);

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
      completedAt: session.completedAt,
      latestEvaluation: session.evaluations[0] ?? null
    };
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
}
