import { IsEnum, IsString } from 'class-validator';
import { BaseSignupDto } from '../base-signup.dto';
import { AccountType } from 'src/common/enums/account-type.enum';

export class EnrichersSignupDto extends BaseSignupDto {
  @IsString()
  organizationName: string;

  @IsEnum(AccountType)
  accountType: AccountType.ENRICHER;
}
