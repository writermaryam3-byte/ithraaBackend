import { IsUUID, IsString, Length } from 'class-validator';
import { BaseSignupDto } from 'src/auth/dto/base-signup.dto';

export class CreateEmployeeDto extends BaseSignupDto {
  @IsString()
  @Length(2, 100)
  job_title: string;

  @IsUUID()
  organization_id: string;
}
