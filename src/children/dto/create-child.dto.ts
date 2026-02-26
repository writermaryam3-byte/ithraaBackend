import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Gender } from 'src/common/enums/gender.enum';

export class CreateChildDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsDateString()
  birthDate: Date;

  @IsEnum(Gender)
  gender: Gender;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsUUID()
  userId: string;
}
