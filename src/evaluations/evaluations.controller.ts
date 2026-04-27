import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/users/decorators/role.decorator';
import { UserRole } from 'src/common/enums/role.enum';
import { type AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { EvaluationsService } from './evaluations.service';
import { StartEvaluationDto } from './dto/start-evaluation.dto';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';

type JwtRequestUser = {
  userId: string;
  roles: { name: UserRole }[];
  email?: string;
  phone?: string;
};

@ApiTags('evaluations')
@ApiBearerAuth()
@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly service: EvaluationsService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Create an evaluation with questions and answers (admin)',
  })
  create(@Body() dto: CreateEvaluationDto, @Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser;
    return this.service.createEvaluation(dto, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    });
  }

  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'Get all evaluations (admin)' })
  getAll(@Req() req: AuthRequest) {
    const user = req.user as unknown as JwtRequestUser;
    return this.service.getAllEvaluationsForAdmin({
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    });
  }

  @Roles(UserRole.ADMIN)
  @Get(':id/details')
  @ApiOperation({
    summary: 'Get evaluation details with questions/answers (admin)',
  })
  getDetails(
    @Param('id', new ParseUUIDPipe()) evaluationId: string,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser;
    return this.service.getEvaluationDetailsForAdmin(evaluationId, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    });
  }

  @Roles(UserRole.PARENT)
  @Post(':id/start')
  @ApiOperation({ summary: 'Start an evaluation attempt for a child (parent)' })
  start(
    @Param('id', new ParseUUIDPipe()) evaluationId: string,
    @Body() dto: StartEvaluationDto,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser;
    return this.service.startEvaluation(evaluationId, dto, {
      userId: user.userId,
      roles: user.roles.map((r) => r.name),
    });
  }
}
