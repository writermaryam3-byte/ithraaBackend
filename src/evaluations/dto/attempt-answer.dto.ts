import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AttemptAnswerDto {
  @ApiProperty({ description: 'Evaluation question ID', format: 'uuid' })
  @IsUUID()
  questionId: string;

  @ApiProperty({ description: 'Parent answer (text or selected option id)' })
  @IsString()
  answer: string;

  @ApiProperty({
    required: false,
    description:
      'Optional correctness flag (can be computed server-side later).',
  })
  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}
