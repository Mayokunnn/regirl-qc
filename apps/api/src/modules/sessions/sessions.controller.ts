import {
  Body,
  Controller,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SessionsService } from './sessions.service';

class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  styleId!: string;

  @IsString()
  @IsNotEmpty()
  skuId!: string;

  @IsString()
  @IsNotEmpty()
  wigId!: string;

  @IsString()
  @IsNotEmpty()
  stylistName!: string;
}

class ConfirmUploadDto {
  @IsString()
  @IsNotEmpty()
  objectKey!: string;
}

class SupervisorOverrideDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

class ReworkFeedbackDto {
  @IsBoolean()
  helpful!: boolean;

  @IsOptional()
  @IsString()
  comment?: string;
}

@Controller('sessions')
@UseGuards(AuthGuard('jwt'))
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  create(@Body() body: CreateSessionDto, @Req() req: { user: { userId: string } }) {
    return this.sessionsService.createDraftSession({ ...body, userId: req.user.userId });
  }

  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20
  ) {
    return this.sessionsService.getSessions({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page,
      limit
    });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.sessionsService.getSessionDetail(id);
  }

  @Post(':id/angles/:angleKey/upload-url')
  uploadUrl(@Param('id') id: string, @Param('angleKey') angleKey: string) {
    return this.sessionsService.requestUploadUrl(id, angleKey);
  }

  @Post(':id/angles/:angleKey/confirm-upload')
  confirm(
    @Param('id') id: string,
    @Param('angleKey') angleKey: string,
    @Body() body: ConfirmUploadDto
  ) {
    return this.sessionsService.confirmUpload(id, angleKey, body.objectKey);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string) {
    return this.sessionsService.submit(id);
  }

  @Get(':id/status')
  status(@Param('id') id: string) {
    return this.sessionsService.getStatus(id);
  }

  /** Supervisor approves an ADVISORY-verdict session with a written reason */
  @Post(':id/override')
  override(
    @Param('id') id: string,
    @Body() body: SupervisorOverrideDto,
    @Req() req: { user: { userId: string } }
  ) {
    return this.sessionsService.supervisorOverride(id, {
      userId: req.user.userId,
      reason: body.reason
    });
  }

  @Post(':id/rework-feedback')
  feedback(
    @Param('id') id: string,
    @Body() body: ReworkFeedbackDto,
    @Req() req: { user: { userId: string } }
  ) {
    return this.sessionsService.saveReworkFeedback(id, {
      helpful: body.helpful,
      comment: body.comment,
      userId: req.user.userId
    });
  }
}
