import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/users/decorators/role.decorator';
import { UserRole } from 'src/common/enums/role.enum';
import { type AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { EvaluationsService } from './evaluations.service';
import { SaveProgressDto } from './dto/save-progress.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

type JwtRequestUser = {
  userId: string;
  roles: { name: UserRole }[];
  email?: string;
  phone?: string;
};

@ApiTags('evaluation-attempts')
@ApiBearerAuth()
@Controller('attempts')
export class AttemptsController {
  constructor(private readonly service: EvaluationsService) {}

  @Roles(UserRole.PARENT)
  @Patch(':id/save')
  @ApiOperation({ summary: 'Save evaluation attempt progress (parent)' })
  save(
    @Param('id', new ParseUUIDPipe()) attemptId: string,
    @Body() dto: SaveProgressDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser;
    return this.service.saveProgress(attemptId, dto, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    });
  }

  @Roles(UserRole.PARENT)
  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit evaluation attempt final answers (parent)' })
  submit(
    @Param('id', new ParseUUIDPipe()) attemptId: string,
    @Body() dto: SubmitAttemptDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser;
    return this.service.submitAttempt(attemptId, dto, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    });
  }

  @Roles(
    UserRole.PARENT,
    UserRole.ADMIN,
    UserRole.ORGANIZATIONOWNER,
    UserRole.EMPLOYEE,
    UserRole.TEACHER,
  )
  @Get(':id')
  @ApiOperation({ summary: 'Get evaluation attempt details' })
  get(
    @Param('id', new ParseUUIDPipe()) attemptId: string,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser;
    return this.service.getAttempt(attemptId, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    });
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve an evaluation attempt (admin)' })
  approve(
    @Param('id', new ParseUUIDPipe()) attemptId: string,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser;
    return this.service.approveAttempt(attemptId, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    });
  }
}
