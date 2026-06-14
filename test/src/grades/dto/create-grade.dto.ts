import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsEnum } from 'class-validator';
import { GradeName } from 'src/common/enums/grade-name.enum';

export class CreateGradeDto {
  @ApiProperty({
    example: GradeName.GradeOne,
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(GradeName)
  name: GradeName;

  @ApiProperty({
    description: 'organization ID',
    example: '0a7d391a-a4e5-4716-89c3-158a97919c89',
    format: 'uuid',
  })
  @IsUUID()
  organizationId: string;
}
