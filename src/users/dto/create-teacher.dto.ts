import { IsUUID, IsString, Length } from 'class-validator';
import { BaseSignupDto } from './base-signup.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTeacherDto extends BaseSignupDto {
  @ApiProperty({
    example: 'KG Teahcer',
  })
  @IsString()
  @Length(2, 100)
  jobTitle: string;

  @ApiProperty({
    description: 'organization ID',
    example: '1540e15b-81af-4c93-a1de-60518e57da63',
    format: 'uuid',
  })
  @IsUUID()
  organizationId: string;
}
