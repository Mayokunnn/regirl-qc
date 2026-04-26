import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getEnv } from '@regirl/config';

@Injectable()
export class QueueService {
  private queue: Queue | null = null;

  private getQueue() {
    if (this.queue) return this.queue;
    const env = getEnv();
    const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
    this.queue = new Queue('session-evaluation', { connection });
    return this.queue;
  }

  async enqueueSessionEvaluation(sessionId: string) {
    await this.getQueue().add('evaluate-session', { sessionId });
  }
}
