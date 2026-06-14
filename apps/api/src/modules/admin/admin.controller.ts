import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../common/prisma.service';
import { Roles, RolesGuard } from '../../common/roles.guard';
import { getStorage } from '@regirl/storage';

class UploadReferenceImageDto {
  @IsString()
  @IsNotEmpty()
  data!: string; // base64-encoded image

  @IsOptional()
  @IsString()
  annotationNote?: string;
}

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

  @Post('reference-sets/:id/angles/:angleKey/upload')
  async uploadReferenceImage(
    @Param('id') referenceSetId: string,
    @Param('angleKey') angleKey: string,
    @Body() body: UploadReferenceImageDto
  ) {
    if (!/^[A-Z0-9_]+$/.test(angleKey)) {
      throw new BadRequestException('Invalid angleKey format');
    }

    const angle = await this.prisma.captureAngle.findUnique({ where: { key: angleKey } });
    if (!angle) throw new NotFoundException(`Angle '${angleKey}' not found`);

    const set = await this.prisma.referenceSet.findUnique({ where: { id: referenceSetId } });
    if (!set) throw new NotFoundException('Reference set not found');

    const buffer = Buffer.from(body.data, 'base64');
    const objectKey = `references/${referenceSetId}/${angleKey}/${Date.now()}.jpg`;
    const storage = getStorage();
    await storage.putObject(objectKey, buffer);

    return this.prisma.referenceImage.create({
      data: {
        referenceSetId,
        angleKey,
        objectKey,
        annotationNote: body.annotationNote ?? null
      }
    });
  }

  @Get('reference-sets/:id/angles')
  async getReferenceSetAngles(@Param('id') referenceSetId: string) {
    const images = await this.prisma.referenceImage.findMany({
      where: { referenceSetId },
      orderBy: { createdAt: 'asc' }
    });

    const storage = getStorage();
    const withUrls = await Promise.all(
      images.map(async (img) => ({
        ...img,
        url: await storage.createReadUrl(img.objectKey)
      }))
    );

    const grouped: Record<string, typeof withUrls> = {};
    for (const img of withUrls) {
      if (!grouped[img.angleKey]) grouped[img.angleKey] = [];
      grouped[img.angleKey].push(img);
    }
    return grouped;
  }
}
