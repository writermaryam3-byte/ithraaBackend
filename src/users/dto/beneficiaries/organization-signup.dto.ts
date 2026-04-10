import { IsEnum, IsString } from 'class-validator';
import { BaseSignupDto } from '../base-signup.dto';
import { OrganizationType } from 'src/common/enums/organization-type.enum';
import { AccountType } from 'src/common/enums/account-type.enum';
import { ApiProperty } from '@nestjs/swagger';

export class OrganizationSignupDto extends BaseSignupDto {
  @ApiProperty({
    example: AccountType.ORGANIZATION,
  })
  @IsEnum(AccountType)
  account_type: AccountType.ORGANIZATION;

  @ApiProperty({
    example: 'organization-name',
  })
  @IsString()
  organization_name: string;

  @ApiProperty({
    example: OrganizationType.SCHOOL,
  })
  @IsEnum(OrganizationType)
  organization_type: OrganizationType;
}
