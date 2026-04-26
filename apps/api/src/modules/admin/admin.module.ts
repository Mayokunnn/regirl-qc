import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AdminController } from './admin.controller';
import { PrismaService } from '../../common/prisma.service';
import { RolesGuard } from '../../common/roles.guard';

@Module({
  imports: [PassportModule],
  controllers: [AdminController],
  providers: [PrismaService, RolesGuard]
})
export class AdminModule {}
