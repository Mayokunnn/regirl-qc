import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../../common/prisma.service';
import { QueueService } from '../../common/queue.service';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, PrismaService, QueueService]
})
export class SessionsModule {}
