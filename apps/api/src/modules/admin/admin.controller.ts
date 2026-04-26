import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../common/prisma.service';
import { Roles, RolesGuard } from '../../common/roles.guard';

class CreateReferenceSetDto {
  @IsString()
  @IsNotEmpty()
  styleId!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @IsNotEmpty()
  promptVersion!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  images!: Array<{ angleKey: string; objectKey: string }>;
}

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('reference-sets')
  async createReferenceSet(
    @Body() body: CreateReferenceSetDto,
    @Req() req: { user: { userId: string } }
  ) {
    return this.prisma.referenceSet.create({
      data: {
        styleId: body.styleId,
        version: body.version,
        promptVersion: body.promptVersion,
        description: body.description,
        createdByUserId: req.user.userId,
        images: {
          createMany: {
            data: body.images.map((image) => ({
              angleKey: image.angleKey,
              objectKey: image.objectKey
            }))
          }
        }
      },
      include: { images: true }
    });
  }

  @Post('reference-sets/:id/activate')
  async activate(@Param('id') id: string) {
    const current = await this.prisma.referenceSet.findUnique({ where: { id } });
    if (!current) {
      throw new Error('Reference set not found');
    }

    await this.prisma.referenceSet.updateMany({
      where: { styleId: current.styleId },
      data: { isActive: false }
    });

    return this.prisma.referenceSet.update({
      where: { id },
      data: { isActive: true }
    });
  }

  @Get('reference-sets')
  async list() {
    return this.prisma.referenceSet.findMany({
      include: { style: true, images: true },
      orderBy: [{ styleId: 'asc' }, { version: 'desc' }]
    });
  }
}
