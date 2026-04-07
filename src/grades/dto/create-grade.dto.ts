import { IsString, IsNotEmpty, IsUUID, IsEnum } from 'class-validator';
import { GradeName } from 'src/common/enums/grade-name.enum';

export class CreateGradeDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(GradeName)
  name: GradeName;

  @IsUUID()
  organizationId: string;
}
