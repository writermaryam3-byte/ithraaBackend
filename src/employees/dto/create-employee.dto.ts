import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, Length } from 'class-validator';
import { BaseSignupDto } from 'src/users/dto/base-signup.dto';

export class CreateEmployeeDto extends BaseSignupDto {
  @ApiProperty({
    example: 'employee name',
  })
  @IsString()
  @Length(2, 100)
  job_title: string;

  @ApiProperty({
    description: 'organization ID',
    example: '0a7d391a-a4e5-4716-89c3-158a97919c89',
    format: 'uuid',
  })
  @IsUUID()
  organization_id: string;
}
