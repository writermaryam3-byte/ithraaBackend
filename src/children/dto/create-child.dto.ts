import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsUUID,
  IsNotEmptyObject,
} from 'class-validator';
import { Gender } from 'src/common/enums/gender.enum';
import { BaseSignupDto } from 'src/users/dto/base-signup.dto';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChildDto {
  @ApiProperty({
    example: 'child-name',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: '2007-05-21',
    format: 'date',
  })
  @IsDateString()
  birthDate: Date;

  @ApiProperty({
    example: Gender.MALE,
  })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({
    description: 'organization ID',
    example: '0a7d391a-a4e5-4716-89c3-158a97919c89',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiProperty({
    description: 'class ID',
    example: '0a7d391a-a4e5-4716-89c3-158a97919c89',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  classId?: string;
}

export class CreateChildWithParentDto {
  @ApiProperty({ type: CreateChildDto })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CreateChildDto)
  child: CreateChildDto;

  @ApiProperty({ type: BaseSignupDto })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => BaseSignupDto)
  parent: BaseSignupDto;
}
