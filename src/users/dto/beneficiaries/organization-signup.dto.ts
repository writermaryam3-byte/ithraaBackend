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
  accountType: AccountType.ORGANIZATION;

  @ApiProperty({
    example: 'organization-name',
  })
  @IsString()
  organizationName: string;

  @ApiProperty({
    example: OrganizationType.SCHOOL,
  })
  @IsEnum(OrganizationType)
  organizationType: OrganizationType;

  // @ApiProperty({
  //   example: ApprovalStatus.APPROVED,
  // })
  // @IsEnum(ApprovalStatus)
  // approvalStatus: ApprovalStatus;
}
