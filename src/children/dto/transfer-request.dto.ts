import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RequestTransferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  childId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toOrganizationId: string;
}

export class ApproveTransferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  classId: string;
}
