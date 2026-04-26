import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../common/prisma.service';

@Controller('styles')
@UseGuards(AuthGuard('jwt'))
export class StylesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getStyles() {
    return this.prisma.style.findMany({ where: { deletedAt: null, isActive: true }, orderBy: { name: 'asc' } });
  }

  @Get(':id/skus')
  async getSkus(@Param('id') styleId: string) {
    return this.prisma.sku.findMany({
      where: { styleId, deletedAt: null, isActive: true },
      orderBy: { code: 'asc' }
    });
  }
}
