import { Controller, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/users/decorators/role.decorator';
import { UserRole } from 'src/common/enums/role.enum';
import { type AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { PrivateChildAttemptsService } from './private-child-attempts.service';

type JwtRequestUser = {
  userId: string;
  roles: { name: UserRole }[];
};

@ApiTags('admin-private-attempts')
@ApiBearerAuth()
@Controller('admin/attempts')
export class AdminPrivateAttemptsController {
  constructor(private readonly privateAttempts: PrivateChildAttemptsService) {}

  @Roles(UserRole.ADMIN)
  @Post(':id/approve')
  @ApiOperation({
    summary:
      'Approve an extra private evaluation attempt (creates checkout session)',
  })
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthRequest,
  ) {
    const user = req.user as unknown as JwtRequestUser;
    return this.privateAttempts.adminApproveExtraAttempt(id, user.userId);
  }
}
