import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums/role.enum';
import type { AuthRequest } from 'src/common/interfaces/auth-request.interface';
import { Roles } from 'src/users/decorators/role.decorator';
import { CreateDealDto } from './dto/create-deal.dto';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { DealsService } from './deals.service';

@ApiTags('deals')
@ApiBearerAuth()
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Post()
  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.TEACHER)
  @ApiOperation({ summary: 'Create a new deal' })
  createDeal(@Body() dto: CreateDealDto, @Req() req: AuthRequest) {
    return this.dealsService.createDeal(dto, req.user);
  }

  @Post(':dealId/proposals')
  @Roles(UserRole.ENRICHER)
  @ApiOperation({ summary: 'Submit a proposal for a deal' })
  submitProposal(
    @Param('dealId', new ParseUUIDPipe()) dealId: string,
    @Body() dto: CreateProposalDto,
    @Req() req: AuthRequest,
  ) {
    return this.dealsService.submitProposal(dealId, dto, req.user);
  }
}
