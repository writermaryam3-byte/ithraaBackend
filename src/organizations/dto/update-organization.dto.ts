import { PartialType } from '@nestjs/swagger';
import { BeneficiariesSignupDto } from 'src/users/dto/beneficiaries/beneficiaries-signup.dto';

export class UpdateOrganizationDto extends PartialType(
  BeneficiariesSignupDto,
) {}
