import { Module } from '@nestjs/common';
import { StylesController } from './styles.controller';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [StylesController],
  providers: [PrismaService]
})
export class StylesModule {}
