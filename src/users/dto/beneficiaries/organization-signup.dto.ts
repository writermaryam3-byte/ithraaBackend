import { IsEnum, IsString } from 'class-validator';
import { BaseSignupDto } from '../base-signup.dto';
import { OrganizationType } from 'src/common/enums/organization-type.enum';
import { AccountType } from 'src/common/enums/account-type.enum';

export class OrganizationSignupDto extends BaseSignupDto {
  @IsEnum(AccountType)
  account_type: AccountType.ORGANIZATION;

  @IsString()
  organization_name: string;

  @IsEnum(OrganizationType)
  organization_type: OrganizationType;
}
