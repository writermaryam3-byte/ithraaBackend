import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums/role.enum';
import { Roles } from 'src/users/decorators/role.decorator';
import {
  ApproveTransferDto,
  RequestTransferDto,
} from './dto/transfer-request.dto';
import { TransferService } from './transfer.service';
import { ListTransferRequestsDto } from './dto/list-transfer-requests.dto';

@ApiTags('child-transfers')
@ApiBearerAuth()
@Controller('child-transfers')
export class TransfersController {
  constructor(private readonly transferService: TransferService) {}

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Request moving a child to another organization' })
  requestTransfer(@Body() dto: RequestTransferDto) {
    return this.transferService.requestTransfer(
      dto.childId,
      dto.toOrganizationId,
    );
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a child transfer and assign a class' })
  approveTransfer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveTransferDto,
  ) {
    return this.transferService.approveTransfer(id, dto.classId);
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a child transfer request' })
  rejectTransfer(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.transferService.rejectTransfer(id);
  }

  @Roles(UserRole.ORGANIZATIONOWNER, UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List transfer requests' })
  getTransferRequests(@Query() query: ListTransferRequestsDto) {
    return this.transferService.getTransferRequests(query);
  }
}
